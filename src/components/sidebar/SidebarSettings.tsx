/**
 * SidebarSettings
 *
 * Provider configuration panel in the sidebar.
 * Shows available AI providers and lets users configure API keys,
 * select default models, and enable/disable providers.
 */

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  Key,
  Globe,
  Shield,
  Copy,
  ExternalLink,
  Unplug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  models: { id: string; name: string; description: string }[];
  authType: string;
  configured: boolean;
  enabled: boolean;
  defaultModel: string | null;
  hasEnvKey: boolean;
  hasApiKey: boolean;
  hasOAuthToken: boolean;
}

// ─── Copilot Device Flow UI ─────────────────────────────────────────

interface CopilotDeviceState {
  phase: "idle" | "waiting" | "polling" | "connected" | "error";
  userCode?: string;
  verificationUri?: string;
  deviceCode?: string;
  interval?: number;
  username?: string;
  error?: string;
}

const CopilotConnectCard: React.FC<{
  provider: ProviderInfo;
  onConnected: () => void;
}> = ({ provider, onConnected }) => {
  const [state, setState] = useState<CopilotDeviceState>({ phase: "idle" });
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check connection status on mount
  useEffect(() => {
    if (provider.hasOAuthToken) {
      fetch("/api/auth/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status" }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.connected) {
            setState({
              phase: "connected",
              username: data.username,
            });
          }
        })
        .catch(() => {});
    }
  }, [provider.hasOAuthToken]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleInitiate = async () => {
    setState({ phase: "waiting" });
    try {
      const res = await fetch("/api/auth/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initiate" }),
      });
      const data = await res.json();

      if (data.status === "initiated") {
        setState({
          phase: "polling",
          userCode: data.userCode,
          verificationUri: data.verificationUri,
          deviceCode: data.deviceCode,
          interval: data.interval,
        });

        // Start polling
        const interval = (data.interval ?? 5) * 1000;
        pollRef.current = setInterval(async () => {
          try {
            const pollRes = await fetch("/api/auth/copilot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "poll",
                deviceCode: data.deviceCode,
              }),
            });
            const pollData = await pollRes.json();

            if (pollData.status === "complete") {
              if (pollRef.current) clearInterval(pollRef.current);
              setState({
                phase: "connected",
                username: pollData.username,
              });
              onConnected();
            } else if (
              pollData.status === "expired" ||
              pollData.status === "error"
            ) {
              if (pollRef.current) clearInterval(pollRef.current);
              setState({
                phase: "error",
                error: pollData.error ?? "Code expired. Try again.",
              });
            }
            // "pending" → keep polling
          } catch {
            // Network error — keep trying
          }
        }, interval);
      } else {
        setState({ phase: "error", error: data.error ?? "Failed to start" });
      }
    } catch (err) {
      setState({
        phase: "error",
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  };

  const handleCopyCode = () => {
    if (state.userCode) {
      navigator.clipboard.writeText(state.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/auth/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setState({ phase: "idle" });
      onConnected(); // Refresh provider list
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">{provider.name}</span>
          {state.phase === "connected" ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <AlertCircle className="h-3 w-3 text-amber-500" />
          )}
        </div>
        <Badge
          variant={state.phase === "connected" ? "default" : "outline"}
          className="text-[9px] px-1.5 py-0 h-4"
        >
          {state.phase === "connected" ? "Connected" : "Not connected"}
        </Badge>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {provider.description}
      </p>

      {/* Connected state */}
      {state.phase === "connected" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px] text-green-600">
            <Shield className="h-2.5 w-2.5" />
            <span>Connected as @{state.username}</span>
          </div>

          {/* Model selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">
              Model
            </label>
            <Select defaultValue={provider.models[0]?.id}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {provider.models.map((model) => (
                  <SelectItem
                    key={model.id}
                    value={model.id}
                    className="text-[11px]"
                  >
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[11px] gap-1 text-destructive hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Unplug className="h-3 w-3" />
            )}
            Disconnect
          </Button>
        </>
      )}

      {/* Polling state — show code + link */}
      {state.phase === "polling" && (
        <div className="space-y-2">
          <div className="text-[10px] text-muted-foreground">
            Enter this code at GitHub:
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-center text-sm font-bold font-mono bg-muted rounded px-2 py-1.5 tracking-widest">
              {state.userCode}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCopyCode}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <Button
            variant="default"
            size="sm"
            className="w-full h-7 text-[11px] gap-1"
            onClick={() =>
              window.open(state.verificationUri, "_blank", "noopener")
            }
          >
            <ExternalLink className="h-3 w-3" />
            Open GitHub
          </Button>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            <span>Waiting for authorization...</span>
          </div>
        </div>
      )}

      {/* Idle / Error — show connect button */}
      {(state.phase === "idle" || state.phase === "error") && (
        <>
          {state.error && (
            <div className="text-[10px] text-destructive">{state.error}</div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-[11px] gap-1"
            onClick={handleInitiate}
          >
            <Shield className="h-3 w-3" />
            Connect with GitHub
          </Button>
        </>
      )}

      {/* Waiting (loading) */}
      {state.phase === "waiting" && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

// ─── Provider Card ──────────────────────────────────────────────────

const ProviderCard: React.FC<{
  provider: ProviderInfo;
  onSave: (providerId: string, data: { apiKey?: string; defaultModel?: string; enabled?: boolean }) => Promise<void>;
}> = ({ provider, onSave }) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    provider.defaultModel ?? provider.models[0]?.id ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isConfigured = provider.configured || provider.hasEnvKey;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(provider.id, {
        apiKey: apiKey || undefined,
        defaultModel: selectedModel,
        enabled: true,
      });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // Error handled upstream
    } finally {
      setSaving(false);
    }
  };

  const StatusIcon = () => {
    if (isConfigured) {
      return <Check className="h-3 w-3 text-green-500" />;
    }
    return <AlertCircle className="h-3 w-3 text-amber-500" />;
  };

  const AuthIcon = () => {
    switch (provider.authType) {
      case "api_key":
        return <Key className="h-3 w-3" />;
      case "oauth":
        return <Shield className="h-3 w-3" />;
      default:
        return <Globe className="h-3 w-3" />;
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2.5">
      {/* Provider header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">{provider.name}</span>
          <StatusIcon />
        </div>
        <div className="flex items-center gap-1">
          <AuthIcon />
          <Badge
            variant={isConfigured ? "default" : "outline"}
            className="text-[9px] px-1.5 py-0 h-4"
          >
            {isConfigured ? "Active" : "Not configured"}
          </Badge>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">{provider.description}</p>

      {/* Source indicators */}
      {provider.hasEnvKey && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-600">
          <Globe className="h-2.5 w-2.5" />
          <span>Using environment variable</span>
        </div>
      )}
      {provider.hasApiKey && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-600">
          <Key className="h-2.5 w-2.5" />
          <span>Custom API key configured</span>
        </div>
      )}

      {/* Model selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground">Model</label>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {provider.models.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-[11px]">
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* API key input (for api_key auth type) */}
      {provider.authType === "api_key" && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">
            API Key {provider.hasApiKey && "(update)"}
          </label>
          <div className="flex gap-1">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.hasApiKey ? "••••••••" : "sk-..."}
                className="h-7 text-[11px] pr-7 font-mono"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-7 w-7"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* OAuth providers are handled by dedicated components (e.g., CopilotConnectCard) */}

      {/* Save button */}
      <Button
        variant="default"
        size="sm"
        className="w-full h-7 text-[11px] gap-1"
        onClick={handleSave}
        disabled={saving || (!apiKey && selectedModel === (provider.defaultModel ?? provider.models[0]?.id))}
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : saved ? (
          <Check className="h-3 w-3" />
        ) : null}
        {saved ? "Saved" : "Save"}
      </Button>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────

export const SidebarSettings: React.FC = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (err) {
      console.error("[SidebarSettings] Failed to fetch providers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSave = useCallback(
    async (
      providerId: string,
      data: { apiKey?: string; defaultModel?: string; enabled?: boolean }
    ) => {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, ...data }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Refresh the provider list
      await fetchProviders();
    },
    [fetchProviders]
  );

  return (
    <div className="flex flex-col h-full w-full min-w-0 min-h-0 bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b flex-shrink-0">
        <h2 className="text-xs font-semibold">AI Providers</h2>
      </div>

      {/* Provider List */}
      <ScrollArea className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <p className="text-[10px] text-muted-foreground">
              Configure AI providers to use with the video editor. 
              Environment variables are used as fallback if no custom key is set.
            </p>
            <Separator />
            {providers.map((provider) =>
              provider.id === "copilot" ? (
                <CopilotConnectCard
                  key={provider.id}
                  provider={provider}
                  onConnected={fetchProviders}
                />
              ) : (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onSave={handleSave}
                />
              )
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
