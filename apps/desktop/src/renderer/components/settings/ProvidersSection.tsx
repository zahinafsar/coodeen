import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type ProviderListItem } from "../../lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProviderAvatar } from "./ProviderAvatar";
import { displayName, type CatalogEntry, POPULAR } from "./providerCatalog";
import { ConnectProviderDialog } from "./ConnectProviderDialog";
import { ConnectKeyDialog } from "./ConnectKeyDialog";
import { CustomProviderDialog } from "./CustomProviderDialog";

interface Props {
  providers: ProviderListItem[];
  loading: boolean;
  onChanged: () => void;
}

export function ProvidersSection({ providers, loading, onChanged }: Props) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [keyDialog, setKeyDialog] = useState<CatalogEntry | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const connected = providers.filter(
    (p) => p.hasKey || p.source === "config",
  );
  const connectedIds = new Set(connected.map((p) => p.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Providers</CardTitle>
        <CardDescription>
          Connect AI providers to start chatting. Each provider needs its own
          API key.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {loading ? (
          <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <>
            {connected.length === 0 ? (
              <div className="text-xs text-muted-foreground py-3">
                No providers connected yet.
              </div>
            ) : (
              connected.map((p) => (
                <ConnectedRow key={p.id} provider={p} onChanged={onChanged} />
              ))
            )}
            <Button
              variant="outline"
              size="sm"
              className="self-start mt-2"
              onClick={() => setCatalogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add provider
            </Button>
          </>
        )}
      </CardContent>

      <ConnectProviderDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        catalog={providers}
        connectedIds={connectedIds}
        onSelectProvider={(entry) => {
          setCatalogOpen(false);
          setKeyDialog(entry);
        }}
        onSelectCustom={() => {
          setCatalogOpen(false);
          setCustomOpen(true);
        }}
      />

      <ConnectKeyDialog
        open={!!keyDialog}
        providerId={keyDialog?.id ?? null}
        providerName={keyDialog?.name ?? ""}
        note={keyDialog?.note}
        onOpenChange={(o) => {
          if (!o) setKeyDialog(null);
        }}
        onBack={() => {
          setKeyDialog(null);
          setCatalogOpen(true);
        }}
        onConnected={onChanged}
      />

      <CustomProviderDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        onSaved={onChanged}
      />
    </Card>
  );
}

function ConnectedRow({
  provider,
  onChanged,
}: {
  provider: ProviderListItem;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const isCustom = provider.source === "config";
  const popularNote = POPULAR.find((p) => p.id === provider.id)?.note;
  const name = displayName(provider.id, provider.name);

  async function disconnect() {
    setDeleting(true);
    try {
      const res = isCustom
        ? await api.removeCustomProvider(provider.id)
        : await api.deleteProviderApiKey(provider.id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to disconnect.");
        return;
      }
      toast.success(`${name} disconnected.`);
      onChanged();
    } finally {
      setDeleting(false);
    }
  }

  const subtitle = isCustom
    ? provider.models.map((m) => m.id).join(", ") || "no models"
    : popularNote ?? `${provider.models.length} model${provider.models.length === 1 ? "" : "s"}`;

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-b-0">
      <ProviderAvatar id={provider.id} name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>
          {isCustom ? (
            <Badge variant="outline" className="text-[10px]">
              Custom
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              Connected
            </Badge>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground truncate">
          {subtitle}
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={disconnect}
        disabled={deleting}
        aria-label="Disconnect"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
