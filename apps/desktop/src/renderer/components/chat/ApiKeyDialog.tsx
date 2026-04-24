import { useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ApiKeyDialog({ open, onOpenChange, onSaved }: ApiKeyDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiKey("");
    setEditing(false);
    setLoading(true);
    api
      .providerHasKey("openai")
      .then((v) => {
        setHasKey(v);
        if (!v) setEditing(true);
      })
      .catch(() => {
        setHasKey(false);
        setEditing(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    const key = apiKey.trim();
    if (!key) {
      toast.error("API key is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.setProviderApiKey("openai", key);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save key.");
        return;
      }
      toast.success("OpenAI key saved.");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await api.deleteProviderApiKey("openai");
      if (!res.ok) {
        toast.error(res.error ?? "Failed to remove key.");
        return;
      }
      toast.success("OpenAI key removed.");
      setHasKey(false);
      setEditing(true);
      setApiKey("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove.");
    } finally {
      setDeleting(false);
    }
  }

  const connectedView = hasKey && !editing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>OpenAI API Key</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {loading ? (
            <div className="h-14 flex items-center justify-center text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
              Checking…
            </div>
          ) : connectedView ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="openai-key">Key</Label>
              <div className="relative">
                <Input
                  id="openai-key"
                  type="text"
                  disabled
                  value="sk-#####################"
                  className="pr-20 font-mono"
                  readOnly
                />
                <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditing(true);
                      setApiKey("");
                    }}
                    aria-label="Edit key"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                    aria-label="Delete key"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="openai-key">Key</Label>
              <Input
                id="openai-key"
                type="password"
                autoFocus
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Sit back — we&apos;ll pick the best model for every task.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {connectedView ? "Close" : "Cancel"}
          </Button>
          {!connectedView && (
            <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
