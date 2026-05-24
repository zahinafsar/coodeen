import { app } from "electron";
import { join } from "node:path";
import { loadJson, saveJson } from "./utils/json-store.js";

export interface SessionPrefs {
  providerId?: string;
  modelId?: string;
  previewUrl?: string;
}

function prefsPath(): string {
  return join(app.getPath("userData"), "session-prefs.json");
}

function load(): Record<string, SessionPrefs> {
  return loadJson<Record<string, SessionPrefs>>(prefsPath(), {});
}

export function getPrefs(sessionId: string): SessionPrefs {
  return load()[sessionId] ?? {};
}

export function setPrefs(sessionId: string, patch: SessionPrefs): SessionPrefs {
  const all = load();
  all[sessionId] = { ...all[sessionId], ...patch };
  saveJson(prefsPath(), all);
  return all[sessionId];
}

export function deletePrefs(sessionId: string): void {
  const all = load();
  delete all[sessionId];
  saveJson(prefsPath(), all);
}

export function allPrefs(): Record<string, SessionPrefs> {
  return load();
}
