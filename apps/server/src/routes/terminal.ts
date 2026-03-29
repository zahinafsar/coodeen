import { Hono } from "hono";
import { Pty, type PtySocket } from "../pty/index.js";

const terminal = new Hono();

/** GET /api/terminal — List all PTY sessions */
terminal.get("/", (c) => {
  return c.json(Pty.list());
});

/** POST /api/terminal — Create a new PTY session */
terminal.post("/", async (c) => {
  const body = await c.req.json<{
    command?: string;
    args?: string[];
    cwd?: string;
    title?: string;
    env?: Record<string, string>;
  }>();
  const info = await Pty.create(body);
  return c.json(info);
});

/** GET /api/terminal/:id — Get session info */
terminal.get("/:id", (c) => {
  const id = c.req.param("id");
  const info = Pty.get(id);
  if (!info) return c.json({ error: "Session not found" }, 404);
  return c.json(info);
});

/** DELETE /api/terminal/:id — Kill and remove a PTY session */
terminal.delete("/:id", (c) => {
  const id = c.req.param("id");
  Pty.remove(id);
  return c.json({ ok: true });
});

/** POST /api/terminal/:id/resize — Resize a PTY session */
terminal.post("/:id/resize", async (c) => {
  const id = c.req.param("id");
  const { cols, rows } = await c.req.json<{ cols: number; rows: number }>();
  Pty.resize(id, cols, rows);
  return c.json({ ok: true });
});

export { terminal };

/**
 * WebSocket handler for PTY connections.
 * Called from the Bun.serve websocket config in index.ts.
 *
 * URL pattern: /api/terminal/:id/ws?cursor=0
 */
export function handlePtyWebSocket(req: Request, server: {
  upgrade: (req: Request, opts?: { data?: unknown }) => boolean;
}): Response | undefined {
  const url = new URL(req.url);
  const match = url.pathname.match(/^\/api\/terminal\/([^/]+)\/ws$/);
  if (!match) return undefined;

  const ptyId = match[1];
  if (!Pty.get(ptyId)) {
    return new Response("Session not found", { status: 404 });
  }

  const cursor = (() => {
    const value = url.searchParams.get("cursor");
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < -1) return undefined;
    return parsed;
  })();

  const upgraded = server.upgrade(req, {
    data: { ptyId, cursor },
  });

  if (!upgraded) {
    return new Response("WebSocket upgrade failed", { status: 500 });
  }

  // Bun handles the response when upgrade succeeds
  return undefined;
}

/** Bun WebSocket handlers for PTY connections */
export const ptyWebSocketHandlers = {
  open(ws: { data: { ptyId: string; cursor?: number }; raw?: unknown } & PtySocket) {
    const { ptyId, cursor } = ws.data;
    const socket: PtySocket = {
      get readyState() { return ws.readyState; },
      send: (data) => ws.send(data),
      close: (code?, reason?) => ws.close(code, reason),
    };
    const handler = Pty.connect(ptyId, socket, cursor);
    if (handler) {
      (ws.data as Record<string, unknown>)._handler = handler;
    }
  },
  message(ws: { data: { _handler?: { onMessage: (data: string | ArrayBuffer) => void } } }, message: string | ArrayBuffer) {
    ws.data._handler?.onMessage(message);
  },
  close(ws: { data: { _handler?: { onClose: () => void } } }) {
    ws.data._handler?.onClose();
  },
};
