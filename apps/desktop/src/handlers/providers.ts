import { ipcMain } from "electron";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getClient, getBaseUrl, restartOpencodeSidecar } from "./opencode.js";
import { loadJson, saveJson } from "./utils/json-store.js";

function authFilePath(): string {
  return join(homedir(), ".local", "share", "opencode", "auth.json");
}

function readAuthFile(): Record<string, { type?: string }> {
  return loadJson<Record<string, { type?: string }>>(authFilePath(), {});
}

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
  return loadJson<OpencodeJson>(globalConfigPath(), {});
}

function writeGlobalConfig(data: OpencodeJson): void {
  saveJson(globalConfigPath(), data);
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
    } catch {}
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

async function disposeOpencodeCache(): Promise<void> {
  const base = getBaseUrl();
  if (!base) return;
  try {
    await fetch(`${base}/global/dispose`, { method: "POST" });
  } catch (err) {
    void err;
  }
}

