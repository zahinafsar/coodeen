import { ipcMain } from "electron";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getClient, getBaseUrl } from "./opencode.js";

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
