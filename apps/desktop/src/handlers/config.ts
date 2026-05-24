import { ipcMain, app } from "electron";
import { join } from "node:path";
import { loadJson, saveJson } from "./utils/json-store.js";

function configPath(): string {
  return join(app.getPath("userData"), "app-config.json");
}

type AppConfig = {
  "active-provider"?: string;
};

function loadConfig(): AppConfig {
  return loadJson<AppConfig>(configPath(), {});
}

export function registerConfigHandlers() {
  ipcMain.handle("config:getActiveProvider", () => {
    return loadConfig()["active-provider"] ?? null;
  });

  ipcMain.handle("config:setActiveProvider", (_e, value: string) => {
    const all = loadConfig();
    all["active-provider"] = value;
    saveJson(configPath(), all);
    return { ok: true };
  });
}
