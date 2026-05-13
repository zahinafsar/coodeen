import { useMemo, useState } from "react";
import { Search, Settings2, X } from "lucide-react";
import { type ProviderListItem } from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  POPULAR,
  displayName,
  type CatalogEntry,
} from "./providerCatalog";
import { ProviderAvatar } from "./ProviderAvatar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Full provider list returned by /config/providers.
  catalog: ProviderListItem[];
  // Already-connected ids — hidden from catalog.
  connectedIds: Set<string>;
  onSelectProvider: (entry: CatalogEntry) => void;
  onSelectCustom: () => void;
}

type Row =
  | { kind: "custom" }
  | { kind: "provider"; entry: CatalogEntry; recommended?: boolean };

export function ConnectProviderDialog({
  open,
  onOpenChange,
  catalog,
  connectedIds,
  onSelectProvider,
  onSelectCustom,
}: Props) {
  const [query, setQuery] = useState("");

  // Build the master list:
  //   * Popular entries from our curated set
  //   * Everything else from /config/providers minus popular & connected
  //   * Custom row pinned to top of "Other"
  const { popular, other } = useMemo(() => {
    const popularIds = new Set(POPULAR.map((p) => p.id));
    const popularRows: Row[] = POPULAR.filter(
      (p) => !connectedIds.has(p.id),
    ).map((entry) => ({ kind: "provider", entry, recommended: entry.recommended }));

    const otherRows: Row[] = [{ kind: "custom" }];
    for (const p of catalog) {
      if (popularIds.has(p.id)) continue;
      if (connectedIds.has(p.id)) continue;
      if (p.source === "config") continue;
      otherRows.push({
        kind: "provider",
        entry: { id: p.id, name: displayName(p.id, p.name), note: "" },
      });
    }
    return { popular: popularRows, other: otherRows };
  }, [catalog, connectedIds]);

  const q = query.trim().toLowerCase();
  const matches = (row: Row): boolean => {
    if (!q) return true;
    if (row.kind === "custom") return "custom".includes(q);
    return (
      row.entry.id.toLowerCase().includes(q) ||
      row.entry.name.toLowerCase().includes(q) ||
      row.entry.note.toLowerCase().includes(q)
    );
  };

  const popularFiltered = popular.filter(matches);
  const otherFiltered = other.filter(matches);
  const empty = popularFiltered.length === 0 && otherFiltered.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setQuery("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[520px] p-0 gap-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Connect provider</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3 pb-2 relative">
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            placeholder="Search providers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 pr-8 h-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-auto px-2 pb-3">
          {empty ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No providers match.
            </div>
          ) : (
            <>
              {popularFiltered.length > 0 && (
                <Group label="Popular">
                  {popularFiltered.map((row) =>
                    row.kind === "provider" ? (
                      <ProviderRow
                        key={row.entry.id}
                        entry={row.entry}
                        recommended={row.recommended}
                        onClick={() => onSelectProvider(row.entry)}
                      />
                    ) : null,
                  )}
                </Group>
              )}
              {otherFiltered.length > 0 && (
                <Group label="Other">
                  {otherFiltered.map((row) =>
                    row.kind === "custom" ? (
                      <button
                        key="custom"
                        type="button"
                        onClick={onSelectCustom}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left"
                      >
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground shrink-0">
                          <Settings2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium">Custom</span>
                          <Badge variant="outline" className="text-[10px]">
                            Custom
                          </Badge>
                        </div>
                      </button>
                    ) : (
                      <ProviderRow
                        key={row.entry.id}
                        entry={row.entry}
                        onClick={() => onSelectProvider(row.entry)}
                      />
                    ),
                  )}
                </Group>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function ProviderRow({
  entry,
  recommended,
  onClick,
}: {
  entry: CatalogEntry;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left"
    >
      <ProviderAvatar id={entry.id} name={entry.name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{entry.name}</span>
          {recommended && (
            <Badge variant="secondary" className="text-[10px]">
              Recommended
            </Badge>
          )}
        </div>
        {entry.note && (
          <div className="text-[11px] text-muted-foreground truncate">
            {entry.note}
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant="ghost"
        tabIndex={-1}
        className="h-7 px-2 text-xs pointer-events-none"
      >
        Connect
      </Button>
    </button>
  );
}
