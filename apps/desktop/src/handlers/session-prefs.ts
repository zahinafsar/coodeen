import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface SessionPrefs {
  providerId?: string;
  modelId?: string;
  previewUrl?: string;
}

function prefsPath(): string {
  return join(app.getPath("userData"), "session-prefs.json");
}

function load(): Record<string, SessionPrefs> {
  const p = prefsPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as Record<string, SessionPrefs>;
  } catch {
    return {};
  }
}

function save(data: Record<string, SessionPrefs>): void {
  const p = prefsPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

export function getPrefs(sessionId: string): SessionPrefs {
  return load()[sessionId] ?? {};
}

export function setPrefs(sessionId: string, patch: SessionPrefs): SessionPrefs {
  const all = load();
  all[sessionId] = { ...all[sessionId], ...patch };
  save(all);
  return all[sessionId];
}

export function deletePrefs(sessionId: string): void {
  const all = load();
  delete all[sessionId];
  save(all);
}

export function allPrefs(): Record<string, SessionPrefs> {
  return load();
}
