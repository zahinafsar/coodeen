type IPty = {
  pid: number;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (info: { exitCode: number }) => void) => void;
  resize: (cols: number, rows: number) => void;
  write: (data: string) => void;
  kill: () => void;
};

const BUFFER_LIMIT = 1024 * 1024 * 2; // 2MB rolling buffer
const BUFFER_CHUNK = 64 * 1024; // 64KB chunks for replay

export type PtySocket = {
  readyState: number;
  send: (data: string | Uint8Array | ArrayBuffer) => void;
  close: (code?: number, reason?: string) => void;
};

export interface PtyInfo {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  status: "running" | "exited";
  pid: number;
}

export interface PtyCreateInput {
  command?: string;
  args?: string[];
  cwd?: string;
  title?: string;
  env?: Record<string, string>;
}

interface ActiveSession {
  info: PtyInfo;
  process: IPty;
  buffer: string;
  bufferCursor: number;
  cursor: number;
  subscribers: Set<PtySocket>;
}

const sessions = new Map<string, ActiveSession>();
let idCounter = 0;

function generateId(): string {
  return `pty_${Date.now()}_${++idCounter}`;
}

function detectShell(): string {
  return process.env.SHELL || "/bin/sh";
}

/** Control frame: 0x00 + JSON with cursor position */
function metaFrame(cursor: number): Uint8Array {
  const json = JSON.stringify({ cursor });
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  const out = new Uint8Array(bytes.length + 1);
  out[0] = 0;
  out.set(bytes, 1);
  return out;
}

async function spawnPty(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<IPty> {
  // Try bun-pty first (Bun runtime)
  try {
    const { spawn } = await import("bun-pty");
    return spawn(command, args, { name: "xterm-256color", cwd, env });
  } catch {}

  // Try @lydell/node-pty (prebuilt binaries, no compilation)
  try {
    const nodePty = await import("@lydell/node-pty");
    const raw = nodePty.spawn(command, args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env,
    });
    return {
      pid: raw.pid,
      onData: (cb) => { raw.onData(cb); },
      onExit: (cb) => { raw.onExit(cb); },
      resize: (cols, rows) => { raw.resize(cols, rows); },
      write: (data) => { raw.write(data); },
      kill: () => { raw.kill(); },
    };
  } catch {}

  throw new Error(
    "No PTY backend available. Install @lydell/node-pty or run under Bun.",
  );
}

export const Pty = {
  list(): PtyInfo[] {
    return Array.from(sessions.values()).map((s) => s.info);
  },

  get(id: string): PtyInfo | undefined {
    return sessions.get(id)?.info;
  },

  async create(input: PtyCreateInput): Promise<PtyInfo> {
    const id = generateId();
    const command = input.command || detectShell();
    const args = input.args || [];
    if (command.endsWith("sh")) {
      args.push("-l");
    }

    const cwd = input.cwd || process.cwd();
    const env = {
      ...process.env,
      ...input.env,
      TERM: "xterm-256color",
    } as Record<string, string>;

    const ptyProcess = await spawnPty(command, args, cwd, env);

    const info: PtyInfo = {
      id,
      title: input.title || `Terminal ${id.slice(-4)}`,
      command,
      args,
      cwd,
      status: "running",
      pid: ptyProcess.pid,
    };

    const session: ActiveSession = {
      info,
      process: ptyProcess,
      buffer: "",
      bufferCursor: 0,
      cursor: 0,
      subscribers: new Set(),
    };

    sessions.set(id, session);

    ptyProcess.onData((chunk) => {
      session.cursor += chunk.length;

      // Broadcast to all subscribers
      for (const ws of session.subscribers) {
        if (ws.readyState !== 1) {
          session.subscribers.delete(ws);
          continue;
        }
        try {
          ws.send(chunk);
        } catch {
          session.subscribers.delete(ws);
        }
      }

      // Append to rolling buffer
      session.buffer += chunk;
      if (session.buffer.length > BUFFER_LIMIT) {
        const excess = session.buffer.length - BUFFER_LIMIT;
        session.buffer = session.buffer.slice(excess);
        session.bufferCursor += excess;
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[pty] session ${id} exited with code ${exitCode}`);
      session.info.status = "exited";
      for (const ws of session.subscribers) {
        try {
          ws.close(1000, "process exited");
        } catch {}
      }
      session.subscribers.clear();
      sessions.delete(id);
    });

    return info;
  },

  resize(id: string, cols: number, rows: number) {
    const session = sessions.get(id);
    if (session && session.info.status === "running") {
      session.process.resize(cols, rows);
    }
  },

  write(id: string, data: string) {
    const session = sessions.get(id);
    if (session && session.info.status === "running") {
      session.process.write(data);
    }
  },

  remove(id: string) {
    const session = sessions.get(id);
    if (!session) return;
    try {
      session.process.kill();
    } catch {}
    for (const ws of session.subscribers) {
      try {
        ws.close();
      } catch {}
    }
    session.subscribers.clear();
    sessions.delete(id);
  },

  connect(
    id: string,
    ws: PtySocket,
    cursor?: number,
  ): { onMessage: (data: string | ArrayBuffer) => void; onClose: () => void } | undefined {
    const session = sessions.get(id);
    if (!session) {
      ws.close();
      return;
    }

    session.subscribers.add(ws);

    const cleanup = () => {
      session.subscribers.delete(ws);
    };

    // Replay buffered history
    const start = session.bufferCursor;
    const end = session.cursor;
    const from =
      cursor === -1
        ? end
        : typeof cursor === "number" && Number.isSafeInteger(cursor)
          ? Math.max(0, cursor)
          : 0;

    const data = (() => {
      if (!session.buffer) return "";
      if (from >= end) return "";
      const offset = Math.max(0, from - start);
      if (offset >= session.buffer.length) return "";
      return session.buffer.slice(offset);
    })();

    if (data) {
      try {
        for (let i = 0; i < data.length; i += BUFFER_CHUNK) {
          ws.send(data.slice(i, i + BUFFER_CHUNK));
        }
      } catch {
        cleanup();
        ws.close();
        return;
      }
    }

    // Send current cursor position as control frame
    try {
      ws.send(metaFrame(end));
    } catch {
      cleanup();
      ws.close();
      return;
    }

    return {
      onMessage: (message: string | ArrayBuffer) => {
        Pty.write(id, String(message));
      },
      onClose: () => {
        cleanup();
      },
    };
  },
};
