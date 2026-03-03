/**
 * MCP Configuration
 *
 * Types and loader for MCP server configuration.
 * Follows the Claude Desktop config pattern (mcp-servers.json at project root).
 */

import { readFile } from "fs/promises";
import { resolve } from "path";

// ─── Types ──────────────────────────────────────────────────────────

export interface MCPServerConfig {
  /** Command to run the server */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Optional environment variables */
  env?: Record<string, string>;
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

// ─── Config Loader ──────────────────────────────────────────────────

const DEFAULT_CONFIG_PATH = "./mcp-servers.json";

/**
 * Load and validate MCP server configuration.
 * Returns empty config if the file doesn't exist.
 */
export async function loadMCPConfig(
  configPath?: string
): Promise<MCPConfig> {
  const resolvedPath = resolve(
    configPath || process.env.MCP_CONFIG_PATH || DEFAULT_CONFIG_PATH
  );

  try {
    const raw = await readFile(resolvedPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate structure
    if (!parsed || typeof parsed !== "object") {
      console.warn(`[MCP] Invalid config format in ${resolvedPath}. Expected an object.`);
      return { mcpServers: {} };
    }

    const config: MCPConfig = {
      mcpServers: {},
    };

    const servers = parsed.mcpServers;
    if (!servers || typeof servers !== "object") {
      console.warn(`[MCP] No 'mcpServers' field in config. MCP disabled.`);
      return config;
    }

    for (const [name, serverDef] of Object.entries(servers)) {
      const def = serverDef as Record<string, unknown>;

      if (typeof def.command !== "string") {
        console.warn(`[MCP] Server "${name}" missing 'command' field. Skipping.`);
        continue;
      }

      if (!Array.isArray(def.args)) {
        console.warn(`[MCP] Server "${name}" missing 'args' array. Skipping.`);
        continue;
      }

      config.mcpServers[name] = {
        command: def.command,
        args: def.args as string[],
        env: def.env && typeof def.env === "object"
          ? (def.env as Record<string, string>)
          : undefined,
      };
    }

    const serverCount = Object.keys(config.mcpServers).length;
    if (serverCount > 0) {
      console.log(`[MCP] Loaded ${serverCount} server config(s): ${Object.keys(config.mcpServers).join(", ")}`);
    }

    return config;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist — not an error, MCP is just not configured
      return { mcpServers: {} };
    }

    console.warn(`[MCP] Failed to load config from ${resolvedPath}:`, err);
    return { mcpServers: {} };
  }
}
