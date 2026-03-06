import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const actions = new Hono();

interface ActionConfig {
  name?: string;
  actions?: Array<{
    label: string;
    script: string;
  }>;
}

/** Load .env file and return environment variables */
function loadEnvFile(dirPath: string): NodeJS.ProcessEnv {
  const envPath = resolve(dirPath, ".env");
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (existsSync(envPath)) {
    try {
      const content = require("node:fs").readFileSync(envPath, "utf-8");
      console.log(`[loadEnvFile] Found .env at ${envPath}`);
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
          env[key.trim()] = value;
          if (key.includes("DATABASE")) {
            console.log(`[loadEnvFile] Loaded ${key.trim()}=${value.substring(0, 30)}...`);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load .env from ${dirPath}:`, err);
    }
  } else {
    console.log(`[loadEnvFile] No .env file found at ${envPath}`);
  }

  return env;
}

/** GET /api/actions/config — Get actions from coodeen.json */
actions.get("/config", async (c) => {
  const dir = c.req.query("dir") || process.cwd();
  const resolvedDir = resolve(dir);
  const configPath = resolve(resolvedDir, "coodeen.json");

  try {
    const content = await readFile(configPath, "utf-8");
    const config: ActionConfig = JSON.parse(content);
    return c.json({
      ok: true,
      actions: config.actions || [],
      name: config.name,
    });
  } catch (error) {
    // File doesn't exist or is invalid, return empty actions
    return c.json({
      ok: true,
      actions: [],
      name: "coodeen",
    });
  }
});

/** POST /api/actions/run — Execute an action script */
actions.post("/run", async (c) => {
  const body = await c.req.json<{ dir?: string; script: string }>();
  const dir = resolve(body.dir || process.cwd());
  const { script } = body;

  console.log(`[actions.run] Received dir: ${body.dir}, Resolved dir: ${dir}, Script: ${script}`);

  if (!script) {
    return c.json({ error: "script is required" }, 400);
  }

  const env = loadEnvFile(dir);
  const child = spawn(script, {
    cwd: dir,
    env: env,
    shell: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return c.json({ ok: true, pid: child.pid });
});

export { actions };
