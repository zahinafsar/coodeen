import { ipcMain } from "electron";
import { configDb } from "../db/config.js";

export function registerConfigHandlers() {
  ipcMain.handle("config:getCwd", () => {
    return { cwd: process.cwd() };
  });

  ipcMain.handle("config:getActiveProvider", () => {
    return configDb.get("active-provider");
  });

  ipcMain.handle("config:setActiveProvider", (_e, value: string) => {
    configDb.set("active-provider", value);
    return { ok: true };
  });
}
