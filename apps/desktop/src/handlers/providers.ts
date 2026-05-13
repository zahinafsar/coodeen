import { ipcMain } from "electron";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { getClient, getBaseUrl, restartOpencodeSidecar } from "./opencode.js";

/**
 * Opencode memoizes Provider.list() per Instance — it does NOT refresh
 * when auth.json changes, so asking the server whether a key exists
 * returns stale data until sidecar restart. Read auth.json directly.
 */
function authFilePath(): string {
  return join(homedir(), ".local", "share", "opencode", "auth.json");
}

function readAuthFile(): Record<string, { type?: string }> {
  const p = authFilePath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as Record<
      string,
      { type?: string }
    >;
  } catch {
    return {};
  }
}

// Global opencode config — XDG default `~/.config/opencode/opencode.json`.
function globalConfigDir(): string {
  return (
    process.env.XDG_CONFIG_HOME?.length
      ? join(process.env.XDG_CONFIG_HOME, "opencode")
      : join(homedir(), ".config", "opencode")
  );
}

function globalConfigPath(): string {
  const dir = globalConfigDir();
  const candidates = ["opencode.json", "opencode.jsonc", "config.json"];
  for (const f of candidates) {
    const p = join(dir, f);
    if (existsSync(p)) return p;
  }
  return join(dir, "opencode.json");
}

type OpencodeJson = {
  provider?: Record<string, CustomProviderEntry>;
  [k: string]: unknown;
};

type CustomProviderEntry = {
  npm?: string;
  name?: string;
  options?: { baseURL?: string; apiKey?: string; headers?: Record<string, string> };
  models?: Record<string, { name?: string; tool_call?: boolean }>;
};

function readGlobalConfig(): OpencodeJson {
  const p = globalConfigPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as OpencodeJson;
  } catch {
    return {};
  }
}

function writeGlobalConfig(data: OpencodeJson): void {
  const p = globalConfigPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

type OpencodeProvider = {
  id: string;
  name: string;
  source?: "env" | "config" | "custom" | "api";
  models: Record<string, { id: string; name: string }>;
};

async function fetchProviders(): Promise<OpencodeProvider[]> {
  const client = getClient();
  const res = await client.config.providers();
  const data = res.data as { providers?: OpencodeProvider[] } | undefined;
  return data?.providers ?? [];
}

export function registerProviderHandlers() {
  ipcMain.handle("providers:connectedModels", async () => {
    const providers = await fetchProviders();
    return providers.map((p) => ({
      providerId: p.id,
      label: p.name,
      models: Object.keys(p.models),
    }));
  });

  ipcMain.handle("providers:list", async () => {
    const providers = await fetchProviders();
    const auth = readAuthFile();
    return providers.map((p) => ({
      id: p.id,
      name: p.name,
      source: p.source ?? null,
      hasKey: !!auth[p.id],
      authType: auth[p.id]?.type ?? null,
      models: Object.entries(p.models).map(([id, m]) => ({
        id,
        name: m.name ?? id,
      })),
    }));
  });

  ipcMain.handle("providers:hasKey", async (_e, id: string) => {
    // Read auth.json directly — opencode's Provider cache doesn't refresh
    // after auth mutations, so its API lies until sidecar restart.
    const auth = readAuthFile();
    return !!auth[id];
  });

  ipcMain.handle(
    "providers:setApiKey",
    async (_e, id: string, apiKey: string) => {
      try {
        await getClient().auth.set({
          path: { id },
          body: { type: "api", key: apiKey },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        await disposeOpencodeCache();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    },
  );

  ipcMain.handle("providers:deleteApiKey", async (_e, id: string) => {
    // SDK v1 doesn't expose auth.remove; call the REST endpoint directly.
    const base = getBaseUrl();
    if (!base) return { ok: false, error: "sidecar not ready" };
    try {
      const res = await fetch(
        `${base}/auth/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        return {
          ok: false,
          error: `Delete failed: ${res.status} ${res.statusText}`,
        };
      }
      await disposeOpencodeCache();
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle(
    "providers:addCustom",
    async (
      _e,
      input: {
        id: string;
        name: string;
        baseURL: string;
        models: Array<{ id: string; name?: string; tools?: boolean }>;
        apiKey?: string;
        headers?: Record<string, string>;
      },
    ) => {
      if (!/^[a-z0-9][a-z0-9-_]*$/.test(input.id)) {
        return { ok: false, error: "id must match ^[a-z0-9][a-z0-9-_]*$" };
      }
      if (!input.baseURL.startsWith("http")) {
        return { ok: false, error: "baseURL must start with http(s)" };
      }
      if (!input.models.length) {
        return { ok: false, error: "at least one model required" };
      }
      try {
        const config = readGlobalConfig();
        const provider = (config.provider ??= {});
        const models: Record<string, { name?: string; tool_call?: boolean }> = {};
        for (const m of input.models) {
          models[m.id] = {
            name: m.name ?? m.id,
            // Default opencode capability is toolcall=true; only persist the
            // override when the user explicitly disables tools.
            ...(m.tools === false ? { tool_call: false } : {}),
          };
        }
        provider[input.id] = {
          npm: "@ai-sdk/openai-compatible",
          name: input.name,
          options: {
            baseURL: input.baseURL,
            ...(input.apiKey ? { apiKey: input.apiKey } : {}),
            ...(input.headers && Object.keys(input.headers).length
              ? { headers: input.headers }
              : {}),
          },
          models,
        };
        writeGlobalConfig(config);
        await restartOpencodeSidecar();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.handle("providers:removeCustom", async (_e, id: string) => {
    try {
      const config = readGlobalConfig();
      if (!config.provider || !config.provider[id]) {
        return { ok: true };
      }
      delete config.provider[id];
      writeGlobalConfig(config);
      await restartOpencodeSidecar();
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Auto-discover models. Tries Ollama native /api/tags first, then
  // OpenAI-compatible /v1/models.
  ipcMain.handle("providers:probeOllama", async (_e, baseURL: string) => {
    const trimmed = baseURL.replace(/\/+$/, "");
    const tryTags = trimmed.endsWith("/v1") ? trimmed.slice(0, -3) : trimmed;
    try {
      const r = await fetch(`${tryTags}/api/tags`);
      if (r.ok) {
        const j = (await r.json()) as { models?: Array<{ name?: string; model?: string }> };
        const models = (j.models ?? [])
          .map((m) => m.model ?? m.name ?? "")
          .filter(Boolean);
        if (models.length) return { ok: true, models };
      }
    } catch {
      // fall through to /v1/models
    }
    try {
      const base = trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
      const r = await fetch(`${base}/models`);
      if (!r.ok) {
        return { ok: false, error: `HTTP ${r.status}` };
      }
      const j = (await r.json()) as { data?: Array<{ id?: string }> };
      const models = (j.data ?? []).map((m) => m.id ?? "").filter(Boolean);
      return { ok: true, models };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

/**
 * Force opencode to drop its per-Instance Provider cache so the next
 * request re-reads auth.json. Uses POST /global/dispose — tears down
 * every directory Instance at once. Next call to any endpoint lazily
 * rebuilds that directory's Instance with fresh auth.
 */
async function disposeOpencodeCache(): Promise<void> {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/global/dispose`, { method: "POST" });
  } catch (err) {
    console.warn("[providers] failed to dispose opencode cache:", err);
  }
}

