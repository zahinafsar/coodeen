import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Cpu, ExternalLink, Search, X } from "lucide-react";
import { api, type ProviderListItem, type SessionModel } from "../../lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName } from "../settings/providerCatalog";

interface Props {
  value: SessionModel | null;
  onChange: (model: SessionModel) => void;
}

export function ModelPicker({ value, onChange }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    api
      .listProviders()
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [open]);

  const usable = useMemo(
    () =>
      providers.filter(
        (p) => (p.hasKey || p.source === "config") && p.models.length > 0,
      ),
    [providers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return usable
      .map((p) => ({
        provider: p,
        models: p.models.filter((m) => {
          if (!q) return true;
          return (
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            displayName(p.id, p.name).toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.models.length > 0);
  }, [usable, query]);

  const triggerLabel = value
    ? `${displayName(value.providerId, providerNameFor(providers, value.providerId))} · ${value.modelId}`
    : "Pick model";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border hover:bg-accent"
        >
          <Cpu className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[240px]">{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0 overflow-hidden"
        align="end"
        sideOffset={6}
      >
        <div className="relative border-b">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            placeholder="Search models"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 pr-8 h-9 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-[340px] overflow-auto p-1">
          {usable.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No providers connected.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No models match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map(({ provider, models }) => {
              const pName = displayName(provider.id, provider.name);
              return (
                <div key={provider.id} className="pb-1">
                  <div className="px-2 py-1.5 my-1 border-y text-[10px] uppercase tracking-wider text-muted-foreground">
                    {pName}
                  </div>
                  {models.map((m) => {
                    const active =
                      value?.providerId === provider.id &&
                      value?.modelId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onChange({
                            providerId: provider.id,
                            modelId: m.id,
                          });
                          setOpen(false);
                        }}
                        className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-accent ${
                          active ? "bg-accent" : ""
                        }`}
                      >
                        <div className="flex-1 min-w-0 flex items-baseline gap-2">
                          <span className="text-sm truncate">
                            {m.name || m.id}
                          </span>
                          {m.name && m.name !== m.id && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate">
                              {m.id}
                            </span>
                          )}
                        </div>
                        {active && (
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Manage providers
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function providerNameFor(
  providers: ProviderListItem[],
  id: string,
): string | undefined {
  return providers.find((p) => p.id === id)?.name;
}

