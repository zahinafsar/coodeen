import { ipcMain, app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

function configPath(): string {
  return join(app.getPath("userData"), "app-config.json");
}

type SessionModel = { providerId: string; modelId: string };

type AppConfig = {
  "active-provider"?: string;
  "session-models"?: Record<string, SessionModel>;
};

function loadConfig(): AppConfig {
  const p = configPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as AppConfig;
  } catch {
    return {};
  }
}

function saveConfig(data: AppConfig): void {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

export function registerConfigHandlers() {
  ipcMain.handle("config:getCwd", () => {
    return { cwd: process.cwd() };
  });

  ipcMain.handle("config:getActiveProvider", () => {
    return loadConfig()["active-provider"] ?? null;
  });

  ipcMain.handle("config:setActiveProvider", (_e, value: string) => {
    const all = loadConfig();
    all["active-provider"] = value;
    saveConfig(all);
    return { ok: true };
  });

  ipcMain.handle("config:getSessionModel", (_e, sessionId: string) => {
    return loadConfig()["session-models"]?.[sessionId] ?? null;
  });

  ipcMain.handle(
    "config:setSessionModel",
    (_e, sessionId: string, model: SessionModel) => {
      const all = loadConfig();
      const map = (all["session-models"] ??= {});
      map[sessionId] = model;
      saveConfig(all);
      return { ok: true };
    },
  );
}
