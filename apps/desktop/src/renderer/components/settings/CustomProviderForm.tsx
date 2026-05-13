import { useState } from "react";
import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  onCancel: () => void;
  onSaved: () => void;
}

interface ModelRow {
  id: string;
  name: string;
  tools: boolean;
}

const ID_RE = /^[a-z0-9][a-z0-9-_]*$/;
const OLLAMA_DEFAULT = "http://localhost:11434/v1";

export function CustomProviderForm({ onCancel, onSaved }: Props) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelRow[]>([
    { id: "", name: "", tools: true },
  ]);
  const [probing, setProbing] = useState(false);
  const [saving, setSaving] = useState(false);

  function setModel(i: number, patch: Partial<ModelRow>) {
    setModels((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function probe(urlOverride?: string) {
    const url = (urlOverride ?? baseURL).trim();
    if (!url) {
      toast.error("Set baseURL first.");
      return;
    }
    setProbing(true);
    try {
      const res = await api.probeOllama(url);
      if (!res.ok) {
        toast.error(res.error ?? "Probe failed.");
        return;
      }
      const found = res.models ?? [];
      if (!found.length) {
        toast.error("No models found at baseURL.");
        return;
      }
      setModels(found.map((m) => ({ id: m, name: m, tools: true })));
      toast.success(`Found ${found.length} model${found.length === 1 ? "" : "s"}.`);
    } finally {
      setProbing(false);
    }
  }

  function ollamaPreset() {
    setId((cur) => cur || "ollama");
    setName((cur) => cur || "Ollama");
    setBaseURL(OLLAMA_DEFAULT);
    void probe(OLLAMA_DEFAULT);
  }

  async function save() {
    if (!ID_RE.test(id)) {
      toast.error("id must be lowercase, start with letter/digit.");
      return;
    }
    if (!name.trim()) {
      toast.error("Name required.");
      return;
    }
    if (!baseURL.startsWith("http")) {
      toast.error("baseURL must start with http(s).");
      return;
    }
    const cleanModels = models
      .map((m) => ({
        id: m.id.trim(),
        name: m.name.trim() || m.id.trim(),
        tools: m.tools,
      }))
      .filter((m) => m.id);
    if (!cleanModels.length) {
      toast.error("At least one model required.");
      return;
    }
    const ids = new Set<string>();
    for (const m of cleanModels) {
      if (ids.has(m.id)) {
        toast.error(`Duplicate model id: ${m.id}`);
        return;
      }
      ids.add(m.id);
    }
    setSaving(true);
    try {
      const res = await api.addCustomProvider({
        id,
        name,
        baseURL,
        apiKey: apiKey.trim() || undefined,
        models: cleanModels,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save.");
        return;
      }
      toast.success(`${name} added.`);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={ollamaPreset}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          Ollama preset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-id" className="text-xs">
            ID
          </Label>
          <Input
            id="cp-id"
            placeholder="ollama"
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase())}
            className="h-8 font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-name" className="text-xs">
            Name
          </Label>
          <Input
            id="cp-name"
            placeholder="Ollama"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-base" className="text-xs">
          Base URL
        </Label>
        <div className="flex gap-1.5">
          <Input
            id="cp-base"
            placeholder={OLLAMA_DEFAULT}
            value={baseURL}
            onChange={(e) => setBaseURL(e.target.value)}
            onBlur={() => {
              if (baseURL.trim() && !models.some((m) => m.id)) {
                void probe();
              }
            }}
            className="h-8 font-mono text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => probe()}
            disabled={probing || !baseURL.trim()}
          >
            {probing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Discover"
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-key" className="text-xs">
          API Key <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="cp-key"
          type="password"
          placeholder="leave empty for local Ollama"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="h-8 font-mono text-xs"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Models</Label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setModels((rows) => [
                ...rows,
                { id: "", name: "", tools: true },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add model
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {models.map((m, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <Input
                placeholder="model id (e.g. llama3.1)"
                value={m.id}
                onChange={(e) => setModel(i, { id: e.target.value })}
                className="h-8 font-mono text-xs"
              />
              <Input
                placeholder="display name"
                value={m.name}
                onChange={(e) => setModel(i, { name: e.target.value })}
                className="h-8 text-xs"
              />
              <label
                className="flex items-center gap-1 text-[10px] text-muted-foreground select-none cursor-pointer shrink-0 px-2 py-1 rounded border"
                title="Model supports tool calling (uncheck for Gemma, Phi, etc.)"
              >
                <input
                  type="checkbox"
                  checked={m.tools}
                  onChange={(e) => setModel(i, { tools: e.target.checked })}
                  className="h-3 w-3 accent-primary"
                />
                tools
              </label>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() =>
                  setModels((rows) =>
                    rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows,
                  )
                }
                disabled={models.length === 1}
                aria-label="Remove model"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Save provider
        </Button>
      </div>
    </div>
  );
}
