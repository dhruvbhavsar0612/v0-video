/**
 * SidebarChat
 *
 * The AI chat panel that lives in the sidebar.
 * Reuses the existing ChatPanel's block-based rendering system
 * but adapted for the sidebar layout.
 */

"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Square,
  Brain,
  Wrench,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Timer,
  BarChart3,
  ChevronRight,
  PlayCircle,
} from "lucide-react";

import {
  useChatStore,
  type AgentStatus,
  type ContentBlock,
  type AgentSummary,
  type ChatMessage,
} from "@/stores/chat-store";
import { useAgent } from "@/agent/hooks/use-agent";
import { ModelSelector } from "@/components/chat/ModelSelector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Agent Status Badge ─────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  idle: { label: "Ready", variant: "outline" },
  thinking: { label: "Thinking...", variant: "secondary" },
  executing: { label: "Executing...", variant: "default" },
  generating: { label: "Generating...", variant: "default" },
  reviewing: { label: "Reviewing...", variant: "secondary" },
  rate_limited: { label: "Rate Limited", variant: "destructive" },
  paused: { label: "Paused", variant: "secondary" },
  error: { label: "Error", variant: "destructive" },
};

const AgentStatusBadge: React.FC = () => {
  const agentStatus = useChatStore((s) => s.agentStatus);
  const agentStatusMessage = useChatStore((s) => s.agentStatusMessage);
  const config = STATUS_CONFIG[agentStatus];

  if (agentStatus === "idle") return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
      {agentStatus === "rate_limited" ? (
        <Timer className="h-3 w-3 animate-pulse" />
      ) : (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      <Badge variant={config.variant} className="text-[10px] h-5">
        {config.label}
      </Badge>
      {agentStatusMessage && (
        <span className="text-[10px] text-muted-foreground truncate">
          {agentStatusMessage}
        </span>
      )}
    </div>
  );
};

// ─── Block Sub-Components ───────────────────────────────────────────

const ThinkingBlock: React.FC<{ content: string; isStreaming?: boolean }> = ({
  content,
  isStreaming,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full py-0.5 group">
        <Brain className="h-3 w-3 text-purple-400" />
        <span className="font-medium">Thinking</span>
        {isStreaming && (
          <span className="flex gap-0.5">
            <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        )}
        <ChevronRight
          className={`h-2.5 w-2.5 ml-auto transition-transform ${open ? "rotate-90" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-0.5 pl-4 pr-1 py-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded border-l-2 border-purple-400/30 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {content}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ToolCallBlock: React.FC<{
  toolName: string;
  status: "pending" | "running" | "completed" | "failed";
  source: "builtin" | "mcp";
  mcpServer?: string;
  args?: Record<string, unknown>;
  result?: string;
}> = ({ toolName, status, source, mcpServer, args, result }) => {
  const [open, setOpen] = useState(false);

  const displayName = toolName.startsWith("mcp__")
    ? toolName.split("__").pop() || toolName
    : toolName;

  const StatusIcon = () => {
    switch (status) {
      case "pending":
      case "running":
        return <Loader2 className="h-3 w-3 animate-spin text-blue-400" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-red-500" />;
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] w-full py-0.5 hover:bg-muted/30 rounded px-0.5 transition-colors">
        <Wrench className="h-3 w-3 text-blue-400" />
        <span className="font-medium text-foreground truncate">{displayName}</span>
        <StatusIcon />
        {source === "mcp" && mcpServer ? (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            mcp
          </Badge>
        ) : null}
        <ChevronRight
          className={`h-2.5 w-2.5 ml-auto transition-transform text-muted-foreground ${open ? "rotate-90" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-0.5 pl-4 pr-1 space-y-0.5">
          {args && Object.keys(args).length > 0 && (
            <div className="text-[9px] text-muted-foreground bg-muted/30 rounded p-1.5 border-l-2 border-blue-400/30">
              <pre className="whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div className="text-[9px] text-muted-foreground bg-muted/30 rounded p-1.5 border-l-2 border-green-400/30">
              <pre className="whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                {result}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ProjectUpdateBlock: React.FC<{
  trackCount?: number;
  clipCount?: number;
}> = ({ trackCount, clipCount }) => {
  const parts: string[] = [];
  if (trackCount !== undefined) parts.push(`${trackCount} tracks`);
  if (clipCount !== undefined) parts.push(`${clipCount} clips`);
  const detail = parts.length > 0 ? ` \u2014 ${parts.join(", ")}` : "";

  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <RefreshCw className="h-3 w-3 text-green-500" />
      <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">
        Preview updated{detail}
      </span>
    </div>
  );
};

const TextBlock: React.FC<{ content: string; isStreaming?: boolean }> = ({
  content,
  isStreaming,
}) => {
  if (!content) return null;
  return (
    <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
      {content}
      {isStreaming && (
        <span className="inline-block w-1 h-3.5 bg-current animate-pulse ml-0.5" />
      )}
    </div>
  );
};

const ErrorBlock: React.FC<{ content: string }> = ({ content }) => (
  <div className="flex items-start gap-1.5 py-0.5 text-[11px] text-red-500">
    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
    <span>{content}</span>
  </div>
);

const RateLimitBlock: React.FC<{ waitMs?: number; message?: string }> = ({
  waitMs,
  message,
}) => (
  <div className="flex items-center gap-1.5 py-0.5 text-[11px] text-amber-500">
    <Timer className="h-3 w-3" />
    <span>
      {message || `Rate limited \u2014 retrying in ${Math.ceil((waitMs || 0) / 1000)}s...`}
    </span>
  </div>
);

const SummaryBlock: React.FC<{ summary: AgentSummary }> = ({ summary }) => {
  const [open, setOpen] = useState(false);

  const durationStr =
    summary.durationMs < 1000
      ? `${summary.durationMs}ms`
      : `${(summary.durationMs / 1000).toFixed(1)}s`;

  const toolCount = summary.toolCalls.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full py-1 mt-1 border-t border-border/50">
        <BarChart3 className="h-3 w-3" />
        <span>
          {durationStr}
          {toolCount > 0 && <> &middot; {toolCount} tool{toolCount !== 1 ? "s" : ""}</>}
          {summary.totalIterations > 1 && <> &middot; {summary.totalIterations} iters</>}
        </span>
        <ChevronRight
          className={`h-2.5 w-2.5 ml-auto transition-transform ${open ? "rotate-90" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-0.5 px-1.5 py-1.5 text-[9px] text-muted-foreground bg-muted/30 rounded space-y-0.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span>Duration:</span>
            <span className="font-mono">{durationStr}</span>
            <span>Iterations:</span>
            <span className="font-mono">{summary.totalIterations}</span>
            <span>Output tokens:</span>
            <span className="font-mono">{summary.outputTokens.toLocaleString()}</span>
            {summary.thinkingTokens > 0 && (
              <>
                <span>Thinking:</span>
                <span className="font-mono">{summary.thinkingTokens.toLocaleString()}</span>
              </>
            )}
          </div>
          {summary.toolCalls.length > 0 && (
            <div className="mt-0.5 pt-0.5 border-t border-border/50">
              {summary.toolCalls.map((tc, i) => (
                <div key={i} className="flex items-center gap-1">
                  {tc.success ? (
                    <CheckCircle2 className="h-2 w-2 text-green-500" />
                  ) : (
                    <XCircle className="h-2 w-2 text-red-500" />
                  )}
                  <span className="font-mono">{tc.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ─── Block Renderer ─────────────────────────────────────────────────

const BlockRenderer: React.FC<{
  block: ContentBlock;
  isStreaming?: boolean;
}> = ({ block, isStreaming }) => {
  switch (block.type) {
    case "thinking":
      return <ThinkingBlock content={block.content} isStreaming={isStreaming} />;
    case "text":
      return <TextBlock content={block.content} isStreaming={isStreaming} />;
    case "tool_call":
      return (
        <ToolCallBlock
          toolName={block.toolName}
          status={block.status}
          source={block.source}
          mcpServer={block.mcpServer}
          args={block.arguments}
          result={block.result}
        />
      );
    case "project_update":
      return (
        <ProjectUpdateBlock
          trackCount={block.trackCount}
          clipCount={block.clipCount}
        />
      );
    case "error":
      return <ErrorBlock content={block.content} />;
    case "rate_limit":
      return <RateLimitBlock waitMs={block.waitMs} message={block.message} />;
    default:
      return null;
  }
};

// ─── Message Bubble ─────────────────────────────────────────────────

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === "user";
  const hasBlocks = message.blocks && message.blocks.length > 0;

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? (
          <User className="h-3 w-3" />
        ) : (
          <Bot className="h-3 w-3" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 min-w-0 rounded-lg px-2.5 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground ml-8"
            : "bg-muted mr-8"
        }`}
      >
        {isUser ? (
          <p className="text-[13px] whitespace-pre-wrap">{message.content}</p>
        ) : hasBlocks ? (
          <div className="space-y-0.5">
            {message.blocks!.map((block, i) => (
              <BlockRenderer
                key={i}
                block={block}
                isStreaming={
                  message.isStreaming &&
                  i === message.blocks!.length - 1
                }
              />
            ))}
            {message.summary && <SummaryBlock summary={message.summary} />}
          </div>
        ) : (
          <div className="text-[13px]">
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.isStreaming && (
              <span className="inline-block w-1 h-3.5 bg-current animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Sidebar Chat ─────────────────────────────────────────────

export const SidebarChat: React.FC = () => {
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = useChatStore((s) => s.messages);
  const isProcessing = useChatStore((s) => s.isProcessing);
  const agentStatus = useChatStore((s) => s.agentStatus);
  const { sendMessage, cancelRequest, continueAgent } = useAgent();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;

    setInput("");
    sendMessage(trimmed);
  }, [input, isProcessing, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0 bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b flex-shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold">AI Chat</h2>
        <div className="ml-auto">
          <ModelSelector size="sm" />
        </div>
      </div>

      {/* Agent Status */}
      <AgentStatusBadge />

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        <div className="flex flex-col gap-3 p-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>

      {/* Continue Button */}
      {agentStatus === "paused" && (
        <div className="border-t px-3 py-2 bg-muted/30 flex-shrink-0">
          <Button
            onClick={continueAgent}
            className="w-full gap-1.5 h-8 text-xs"
            variant="outline"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Continue
          </Button>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            Agent paused at iteration limit.
          </p>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 flex-shrink-0">
        <div className="flex gap-1.5">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your video..."
            className="min-h-[48px] max-h-[100px] resize-none text-[13px]"
            disabled={isProcessing}
          />
          <Button
            size="icon"
            onClick={isProcessing ? cancelRequest : handleSend}
            disabled={!isProcessing && !input.trim()}
            className="h-[48px] w-9 flex-shrink-0"
            variant={isProcessing ? "destructive" : "default"}
          >
            {isProcessing ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
