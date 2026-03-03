/**
 * ModelSelector
 *
 * Compact dropdown that lets the user pick a provider + model
 * for the current chat session. Reads from and writes to the
 * model store, which useAgent reads when sending requests.
 *
 * Comes in two sizes:
 * - "default" for ChatPanel header
 * - "sm" for SidebarChat header
 */

"use client";

import React, { useEffect } from "react";
import { ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useModelStore } from "@/stores/model-store";

interface ModelSelectorProps {
  size?: "sm" | "default";
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  size = "default",
}) => {
  const providers = useModelStore((s) => s.providers);
  const selectedProviderId = useModelStore((s) => s.selectedProviderId);
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  const isLoading = useModelStore((s) => s.isLoading);
  const fetchProviders = useModelStore((s) => s.fetchProviders);
  const setProviderAndModel = useModelStore((s) => s.setProviderAndModel);
  const fetchedAt = useModelStore((s) => s.fetchedAt);

  // Fetch providers on first mount (or if stale)
  useEffect(() => {
    if (!fetchedAt) {
      fetchProviders();
    }
  }, [fetchedAt, fetchProviders]);

  // Build a composite value: "providerId::modelId"
  const compositeValue =
    selectedProviderId && selectedModelId
      ? `${selectedProviderId}::${selectedModelId}`
      : undefined;

  const handleChange = (value: string) => {
    const [providerId, modelId] = value.split("::");
    if (providerId && modelId) {
      setProviderAndModel(providerId, modelId);
    }
  };

  // Only show configured providers
  const configuredProviders = providers.filter((p) => p.configured);

  if (isLoading && configuredProviders.length === 0) {
    return (
      <div
        className={`flex items-center gap-1.5 text-muted-foreground ${
          size === "sm" ? "text-[10px]" : "text-xs"
        }`}
      >
        <ChevronsUpDown className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        <span>Loading models...</span>
      </div>
    );
  }

  if (configuredProviders.length === 0) {
    return (
      <div
        className={`flex items-center gap-1.5 text-muted-foreground ${
          size === "sm" ? "text-[10px]" : "text-xs"
        }`}
      >
        <span>No providers configured</span>
      </div>
    );
  }

  return (
    <Select value={compositeValue} onValueChange={handleChange}>
      <SelectTrigger
        size="sm"
        className={`
          border-0 shadow-none bg-transparent px-1.5 gap-1
          focus-visible:ring-0 focus-visible:border-0
          ${size === "sm"
            ? "h-6 text-[10px] max-w-[180px]"
            : "h-7 text-xs max-w-[220px]"
          }
        `}
      >
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {configuredProviders.map((provider) => (
          <SelectGroup key={provider.id}>
            <SelectLabel
              className={`font-semibold ${
                size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs"
              }`}
            >
              {provider.name}
              {provider.fromLiveApi && (
                <span className="ml-1 text-muted-foreground font-normal">
                  (live)
                </span>
              )}
            </SelectLabel>
            {provider.models.map((model) => (
              <SelectItem
                key={`${provider.id}::${model.id}`}
                value={`${provider.id}::${model.id}`}
                className={size === "sm" ? "text-[11px] py-1" : "text-xs"}
              >
                <span className="truncate">{model.name}</span>
                {model.featured && (
                  <span className="ml-1 text-primary text-[9px]">*</span>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};
