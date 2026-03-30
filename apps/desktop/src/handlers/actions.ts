import { ipcMain } from "electron";
import { readFile, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";

interface ActionConfig {
  name?: string;
  actions?: Array<{
    label: string;
    script: string;
  }>;
}

function loadEnvFile(dirPath: string): NodeJS.ProcessEnv {
  const envPath = resolve(dirPath, ".env");
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          const value = valueParts
            .join("=")
            .trim()
            .replace(/^["']|["']$/g, "");
          env[key.trim()] = value;
        }
      }
    } catch {}
  }

  return env;
}

export function registerActionHandlers() {
  ipcMain.handle("actions:getConfig", async (_e, dir: string) => {
    const resolvedDir = resolve(dir);
    const configPath = resolve(resolvedDir, "coodeen.json");

    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config: ActionConfig = JSON.parse(content);
      return {
        ok: true,
        actions: config.actions || [],
        name: config.name,
      };
    } catch {
      return { ok: true, actions: [], name: "coodeen" };
    }
  });

  ipcMain.handle("actions:run", async (_e, dir: string, script: string) => {
    const d = resolve(dir);
    const env = loadEnvFile(d);
    const child = spawn(script, {
      cwd: d,
      env,
      shell: true,
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return { ok: true, pid: child.pid };
  });
}
