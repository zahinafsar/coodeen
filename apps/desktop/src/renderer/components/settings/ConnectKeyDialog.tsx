import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderAvatar } from "./ProviderAvatar";

interface Props {
  open: boolean;
  providerId: string | null;
  providerName: string;
  note?: string;
  onOpenChange: (open: boolean) => void;
  onBack?: () => void;
  onConnected: () => void;
}

export function ConnectKeyDialog({
  open,
  providerId,
  providerName,
  note,
  onOpenChange,
  onBack,
  onConnected,
}: Props) {
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setKey("");
  }, [open, providerId]);

  async function save() {
    if (!providerId) return;
    const trimmed = key.trim();
    if (!trimmed) {
      toast.error("API key required.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.setProviderApiKey(providerId, trimmed);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save.");
        return;
      }
      toast.success(`${providerName} connected.`);
      onConnected();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 -ml-1"
                onClick={onBack}
                aria-label="Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {providerId && (
              <ProviderAvatar id={providerId} name={providerName} size={32} />
            )}
            <div className="flex flex-col">
              <DialogTitle>Connect {providerName}</DialogTitle>
              {note && (
                <DialogDescription className="mt-0.5">{note}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 py-1">
          <Label htmlFor="provider-key" className="text-xs">
            API Key
          </Label>
          <Input
            id="provider-key"
            autoFocus
            type="password"
            placeholder="Paste your API key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className="font-mono"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !key.trim()}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
