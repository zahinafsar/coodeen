import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { app, BrowserWindow } from "electron";
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";

let child: ChildProcess | null = null;
let client: OpencodeClient | null = null;
let baseUrl: string | null = null;
let readyPromise: Promise<OpencodeClient> | null = null;

let subscriptionLoopActive = false;
let subscriptionAbort: AbortController | null = null;
let stopped = false;

const HEARTBEAT_MS = 15_000;
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 5_000;

function resolveBinaryPath(): string {
  const binName = process.platform === "win32" ? "opencode.exe" : "opencode";

  if (app.isPackaged) {
    return join(process.resourcesPath, "bin", binName);
  }

  // Dev: apps/desktop/resources/bin/<bin>
  const devPath = resolve(__dirname, "../../resources/bin", binName);
  if (existsSync(devPath)) return devPath;

  // Fallback: PATH
  return binName;
}

async function boot(): Promise<OpencodeClient> {
  const binary = resolveBinaryPath();
  const args = ["serve", "--hostname=127.0.0.1", "--port=0"];

  const proc = spawn(binary, args, {
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child = proc;

  const url = await new Promise<string>((resolveUrl, rejectUrl) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    const timer = setTimeout(() => {
      rejectUrl(
        new Error(
          `Timed out waiting for opencode sidecar.\nstdout: ${stdoutBuf}\nstderr: ${stderrBuf}`,
        ),
      );
    }, 10_000);

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      for (const line of stdoutBuf.split("\n")) {
        const m = line.match(/opencode server listening\s+on\s+(https?:\/\/\S+)/);
        if (m) {
          clearTimeout(timer);
          resolveUrl(m[1]);
          return;
        }
      }
    });
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });
    proc.on("exit", (code, signal) => {
      clearTimeout(timer);
      rejectUrl(
        new Error(
          `opencode sidecar exited early (code=${code} signal=${signal})\nstdout: ${stdoutBuf}\nstderr: ${stderrBuf}`,
        ),
      );
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      rejectUrl(err);
    });
  });

  baseUrl = url;
  const c = createOpencodeClient({ baseUrl: url });
  client = c;
  console.log(`[opencode] sidecar ready at ${url}`);
  startEventBus(c);
  return c;
}

/**
 * Build request options that scope the call to a specific project directory.
 * The opencode server reads `x-opencode-directory` (encoded) OR the `directory`
 * query param; the SDK only rewrites GET/HEAD, so we add the header ourselves
 * for POST/PATCH/DELETE.
 */
export function dirOptions(dir?: string) {
  if (!dir) return {};
  return {
    headers: {
      "x-opencode-directory": encodeURIComponent(dir),
    },
    query: { directory: dir },
  };
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

async function runSubscription(
  c: OpencodeClient,
  signal: AbortSignal,
): Promise<void> {
  // Use /global/event (GlobalBus) — emits events from ALL directory
  // instances. /event is per-instance and would miss events emitted
  // when a request runs against a different projectDir.
  const sub = await c.global.event({ signal });
  let heartbeat: NodeJS.Timeout | null = null;
  const resetHeartbeat = () => {
    if (heartbeat) clearTimeout(heartbeat);
    heartbeat = setTimeout(() => {
      // No events in HEARTBEAT_MS — force the underlying fetch to abort
      // so the outer loop reconnects.
      subscriptionAbort?.abort();
    }, HEARTBEAT_MS);
  };
  resetHeartbeat();

  try {
    for await (const raw of sub.stream as AsyncIterable<{
      directory?: string;
      payload?: { type?: string; properties?: unknown };
      // fallback: if server ever emits unwrapped
      type?: string;
      properties?: unknown;
    }>) {
      if (signal.aborted) break;
      resetHeartbeat();
      // /global/event wraps each event as { directory, payload }.
      // Unwrap so the renderer reducer sees { type, properties }.
      const evt = raw?.payload ?? raw;
      console.log("[opencode] event:", evt?.type);
      broadcast("opencode:event", evt);
    }
  } finally {
    if (heartbeat) clearTimeout(heartbeat);
  }
}

async function startEventBus(c: OpencodeClient): Promise<void> {
  if (subscriptionLoopActive) return;
  subscriptionLoopActive = true;

  let attempt = 0;
  while (!stopped) {
    subscriptionAbort = new AbortController();
    try {
      broadcast("opencode:status", { connected: true });
      await runSubscription(c, subscriptionAbort.signal);
      // Stream ended normally — server closed; reconnect.
      attempt = 0;
    } catch (err) {
      if (stopped) break;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[opencode] event bus error:", msg);
    } finally {
      broadcast("opencode:status", { connected: false });
    }

    if (stopped) break;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_MIN_MS * Math.pow(2, attempt),
    );
    attempt = Math.min(attempt + 1, 6);
    await new Promise((r) => setTimeout(r, delay));
  }

  subscriptionLoopActive = false;
}

export function reconnectEventBus(): void {
  subscriptionAbort?.abort();
}

export function startOpencodeSidecar(): Promise<OpencodeClient> {
  if (!readyPromise) {
    stopped = false;
    readyPromise = boot();
  }
  return readyPromise;
}

export function getClient(): OpencodeClient {
  if (!client) {
    throw new Error("opencode sidecar not ready — call startOpencodeSidecar first");
  }
  return client;
}

export function getBaseUrl(): string | null {
  return baseUrl;
}

export async function restartOpencodeSidecar(): Promise<OpencodeClient> {
  stopOpencodeSidecar();
  // stopOpencodeSidecar nulls everything synchronously; startOpencodeSidecar
  // boots a fresh child process. Caller awaits ready client.
  return startOpencodeSidecar();
}

export function stopOpencodeSidecar(): void {
  stopped = true;
  subscriptionAbort?.abort();
  if (child && !child.killed) {
    try {
      child.kill();
    } catch {}
  }
  child = null;
  client = null;
  baseUrl = null;
  readyPromise = null;
  subscriptionLoopActive = false;
}
