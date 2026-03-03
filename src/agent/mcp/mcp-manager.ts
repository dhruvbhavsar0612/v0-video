/**
 * MCP Manager
 *
 * Manages connections to MCP servers, discovers their tools,
 * converts to Anthropic tool format, and routes tool calls.
 *
 * Uses StdioClientTransport from @modelcontextprotocol/sdk to
 * spawn and communicate with MCP server processes.
 *
 * Singleton pattern — connections are reused across requests.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

import { loadMCPConfig, type MCPServerConfig } from "./mcp-config";

// ─── Types ──────────────────────────────────────────────────────────

interface MCPServerConnection {
  name: string;
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  tools: MCPToolInfo[];
  connected: boolean;
}

export interface MCPToolInfo {
  /** Original tool name from the MCP server */
  name: string;
  /** Anthropic-formatted tool (with prefixed name) */
  anthropicTool: Tool;
  /** Which MCP server provides this tool */
  serverName: string;
}

export interface MCPToolCallResult {
  content: string;
  isError: boolean;
}

// ─── MCP Manager ────────────────────────────────────────────────────

let instance: MCPManager | null = null;

export class MCPManager {
  private servers: Map<string, MCPServerConnection> = new Map();
  private initialized = false;

  /**
   * Get the singleton MCPManager instance.
   */
  static getInstance(): MCPManager {
    if (!instance) {
      instance = new MCPManager();
    }
    return instance;
  }

  /**
   * Initialize MCP connections from config.
   * Safe to call multiple times — will only initialize once.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const config = await loadMCPConfig();
    const serverEntries = Object.entries(config.mcpServers);

    if (serverEntries.length === 0) {
      return;
    }

    // Connect to each server in parallel
    const results = await Promise.allSettled(
      serverEntries.map(([name, serverConfig]) =>
        this.connectServer(name, serverConfig)
      )
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const name = serverEntries[i][0];
      if (result.status === "rejected") {
        console.error(`[MCP] Failed to connect to "${name}":`, result.reason);
      }
    }
  }

  /**
   * Connect to a single MCP server and discover its tools.
   */
  private async connectServer(
    name: string,
    config: MCPServerConfig
  ): Promise<void> {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env
        ? { ...process.env, ...config.env } as Record<string, string>
        : undefined,
    });

    const client = new Client({
      name: "reelforge-agent",
      version: "1.0.0",
    });

    await client.connect(transport);

    // Discover tools
    const toolsResponse = await client.listTools();
    const tools: MCPToolInfo[] = (toolsResponse.tools || []).map((tool) => ({
      name: tool.name,
      serverName: name,
      anthropicTool: {
        name: `mcp__${name}__${tool.name}`,
        description: tool.description || `MCP tool from ${name}: ${tool.name}`,
        input_schema: (tool.inputSchema as Tool["input_schema"]) || {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
    }));

    const connection: MCPServerConnection = {
      name,
      config,
      client,
      transport,
      tools,
      connected: true,
    };

    this.servers.set(name, connection);
    console.log(
      `[MCP] Connected to "${name}" — ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`
    );
  }

  /**
   * Get all MCP tools in Anthropic format.
   * These can be merged with built-in tools when calling Claude.
   */
  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const server of this.servers.values()) {
      if (server.connected) {
        for (const tool of server.tools) {
          tools.push(tool.anthropicTool);
        }
      }
    }
    return tools;
  }

  /**
   * Check if a tool name belongs to an MCP server.
   * MCP tool names are prefixed: mcp__{serverName}__{toolName}
   */
  isMCPTool(toolName: string): boolean {
    return toolName.startsWith("mcp__");
  }

  /**
   * Parse an MCP tool name into its server and tool components.
   */
  parseMCPToolName(prefixedName: string): { serverName: string; toolName: string } | null {
    const match = prefixedName.match(/^mcp__([^_]+(?:__[^_]+)*)__(.+)$/);
    if (!match) return null;

    // Handle server names that might not contain double underscores
    // Try to find the actual server first
    for (const server of this.servers.values()) {
      const prefix = `mcp__${server.name}__`;
      if (prefixedName.startsWith(prefix)) {
        return {
          serverName: server.name,
          toolName: prefixedName.slice(prefix.length),
        };
      }
    }

    return null;
  }

  /**
   * Execute a tool call on the appropriate MCP server.
   */
  async callTool(
    prefixedName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolCallResult> {
    const parsed = this.parseMCPToolName(prefixedName);
    if (!parsed) {
      return {
        content: `Error: Unable to parse MCP tool name "${prefixedName}"`,
        isError: true,
      };
    }

    const server = this.servers.get(parsed.serverName);
    if (!server || !server.connected) {
      return {
        content: `Error: MCP server "${parsed.serverName}" is not connected`,
        isError: true,
      };
    }

    try {
      const result = await server.client.callTool({
        name: parsed.toolName,
        arguments: args,
      });

      // Extract text content from MCP result
      const content = (result.content as Array<{ type: string; text?: string }>)
        ?.map((block) => {
          if (block.type === "text" && block.text) return block.text;
          return JSON.stringify(block);
        })
        .join("\n") || JSON.stringify(result);

      return {
        content,
        isError: result.isError === true,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown MCP error";
      return {
        content: `MCP tool error (${parsed.serverName}/${parsed.toolName}): ${message}`,
        isError: true,
      };
    }
  }

  /**
   * Get the list of MCP server names that are currently connected.
   */
  getConnectedServers(): string[] {
    const names: string[] = [];
    for (const server of this.servers.values()) {
      if (server.connected) names.push(server.name);
    }
    return names;
  }

  /**
   * Disconnect all MCP servers. Call on shutdown.
   */
  async disconnect(): Promise<void> {
    const disconnects = Array.from(this.servers.values()).map(async (server) => {
      try {
        await server.client.close();
        server.connected = false;
      } catch {
        // Ignore disconnect errors
      }
    });

    await Promise.allSettled(disconnects);
    this.servers.clear();
    this.initialized = false;
    instance = null;
  }
}
