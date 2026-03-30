import { ipcMain, type BrowserWindow } from "electron";

type IPty = {
  pid: number;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (info: { exitCode: number }) => void) => void;
  resize: (cols: number, rows: number) => void;
  write: (data: string) => void;
  kill: () => void;
};

interface PtySession {
  id: string;
  title: string;
  command: string;
  cwd: string;
  status: "running" | "exited";
  pid: number;
  process: IPty;
}

const sessions = new Map<string, PtySession>();
let idCounter = 0;

function generateId(): string {
  return `pty_${Date.now()}_${++idCounter}`;
}

function detectShell(): string {
  return process.env.SHELL || "/bin/sh";
}

async function spawnPty(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<IPty> {
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
      onData: (cb) => {
        raw.onData(cb);
      },
      onExit: (cb) => {
        raw.onExit(cb);
      },
      resize: (cols, rows) => {
        raw.resize(cols, rows);
      },
      write: (data) => {
        raw.write(data);
      },
      kill: () => {
        raw.kill();
      },
    };
  } catch {
    throw new Error(
      "No PTY backend available. Install @lydell/node-pty.",
    );
  }
}

export function registerPtyHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    "pty:create",
    async (
      _e,
      opts?: { cwd?: string; command?: string; title?: string },
    ) => {
      const id = generateId();
      const command = opts?.command || detectShell();
      const args: string[] = [];
      if (command.endsWith("sh")) {
        args.push("-l");
      }

      const cwd = opts?.cwd || process.cwd();
      const env = {
        ...process.env,
        TERM: "xterm-256color",
      } as Record<string, string>;

      const ptyProcess = await spawnPty(command, args, cwd, env);

      const session: PtySession = {
        id,
        title: opts?.title || `Terminal ${id.slice(-4)}`,
        command,
        cwd,
        status: "running",
        pid: ptyProcess.pid,
        process: ptyProcess,
      };

      sessions.set(id, session);

      // Forward PTY output to renderer
      ptyProcess.onData((data) => {
        const win = getWindow();
        win?.webContents.send("pty:data", { id, data });
      });

      ptyProcess.onExit(({ exitCode }) => {
        const win = getWindow();
        win?.webContents.send("pty:exit", { id, exitCode });
        session.status = "exited";
        sessions.delete(id);
      });

      return {
        id,
        title: session.title,
        command: session.command,
        cwd: session.cwd,
        status: session.status,
        pid: session.pid,
      };
    },
  );

  ipcMain.handle("pty:write", (_e, id: string, data: string) => {
    const session = sessions.get(id);
    if (session && session.status === "running") {
      session.process.write(data);
    }
  });

  ipcMain.handle(
    "pty:resize",
    (_e, id: string, cols: number, rows: number) => {
      const session = sessions.get(id);
      if (session && session.status === "running") {
        session.process.resize(cols, rows);
      }
      return { ok: true };
    },
  );

  ipcMain.handle("pty:kill", (_e, id: string) => {
    const session = sessions.get(id);
    if (session) {
      try {
        session.process.kill();
      } catch {}
      sessions.delete(id);
    }
    return { ok: true };
  });

  ipcMain.handle("pty:list", () => {
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
    }));
  });
}
