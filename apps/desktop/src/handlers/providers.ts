import { ipcMain } from "electron";
import { providerDb } from "../db/providers.js";
import { getModelsConfig, getFreeModels } from "./ai-models.js";

function maskKey(key: string): string {
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

export function registerProviderHandlers() {
  ipcMain.handle("providers:list", () => {
    const list = providerDb.list();
    return list.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) }));
  });

  ipcMain.handle("providers:models", async (_e, providerName: string) => {
    const name = providerName.toLowerCase();
    const config = await getModelsConfig();

    if (name === config.free.provider) {
      const free = await getFreeModels();
      return { provider: name, models: free.map((m) => m.id) };
    }

    const entry = config.providers[name];
    if (!entry) {
      const supported = [
        ...Object.keys(config.providers),
        config.free.provider,
      ].join(", ");
      throw new Error(
        `Unknown provider: ${name}. Supported: ${supported}`,
      );
    }
    return { provider: name, models: entry.models.map((m) => m.id) };
  });

  ipcMain.handle("providers:connectedModels", async () => {
    const [list, config, free] = await Promise.all([
      providerDb.list(),
      getModelsConfig(),
      getFreeModels(),
    ]);

    const result: {
      providerId: string;
      label: string;
      models: string[];
      free?: boolean;
    }[] = [
      {
        providerId: config.free.provider,
        label: config.free.label,
        models: free.map((m) => m.id),
        free: true,
      },
    ];

    for (const p of list) {
      const entry = config.providers[p.id];
      if (entry) {
        result.push({
          providerId: p.id,
          label: entry.label,
          models: entry.models.map((m) => m.id),
        });
      }
    }

    return result;
  });

  ipcMain.handle("providers:freeModels", async () => {
    return getFreeModels();
  });

  ipcMain.handle("providers:config", async () => {
    return getModelsConfig();
  });

  ipcMain.handle(
    "providers:upsert",
    (_e, id: string, data: { apiKey: string }) => {
      const result = providerDb.upsert(id, {
        apiKey: data.apiKey,
        modelId: "",
      });
      return { ...result, apiKey: maskKey(result.apiKey) };
    },
  );

  ipcMain.handle("providers:delete", (_e, id: string) => {
    providerDb.delete(id);
    return { ok: true };
  });
}
