import { ipcMain } from "electron";
import { join } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { loadJson, saveJson } from "./utils/json-store.js";
import { broadcast } from "./utils/ipc.js";

export interface CoodeenPage {
  route: string;
  compact?: boolean;
}

export interface CoodeenConfig {
  design?: {
    host: string;
    pages: CoodeenPage[];
  };
}

function configPath(dir: string) {
  return join(dir, "coodeen.json");
}

function readConfig(dir: string): CoodeenConfig | null {
  return loadJson<CoodeenConfig | null>(configPath(dir), null);
}

function writeConfig(dir: string, data: CoodeenConfig): void {
  saveJson(configPath(dir), data);
}

const watchers = new Map<string, FSWatcher>();

function ensureWatcher(dir: string) {
  if (watchers.has(dir)) return;
  const w = chokidar.watch(configPath(dir), {
    ignoreInitial: true,
    persistent: true,
  });
  const fire = () => broadcast("coodeen:changed", { dir });
  w.on("add", fire);
  w.on("change", fire);
  w.on("unlink", fire);
  watchers.set(dir, w);
}

function disposeWatchers() {
  for (const w of watchers.values()) w.close().catch(() => {});
  watchers.clear();
}

export function registerCoodeenHandlers() {
  ipcMain.handle("coodeen:get", (_e, dir: string) => {
    if (!dir) return null;
    ensureWatcher(dir);
    return readConfig(dir);
  });

  ipcMain.handle("coodeen:set", (_e, dir: string, data: CoodeenConfig) => {
    if (!dir) return { ok: false, error: "no dir" };
    try {
      writeConfig(dir, data);
      ensureWatcher(dir);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("coodeen:watch", (_e, dir: string) => {
    if (!dir) return { ok: false };
    ensureWatcher(dir);
    return { ok: true };
  });
}

export function stopCoodeenWatchers() {
  disposeWatchers();
}
