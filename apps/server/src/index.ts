// Polyfill TextDecoderStream for older runtimes
if (typeof globalThis.TextDecoderStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).TextDecoderStream = class TextDecoderStream extends TransformStream<Uint8Array, string> {
    constructor(encoding = "utf-8", options?: TextDecoderOptions) {
      const decoder = new TextDecoder(encoding, options);
      super({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          if (text) controller.enqueue(text);
        },
        flush(controller) {
          const text = decoder.decode();
          if (text) controller.enqueue(text);
        },
      });
    }
  };
}

import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { chat } from "./routes/chat.js";
import { sessions } from "./routes/sessions.js";
import { providers } from "./routes/providers.js";
import { configRoutes } from "./routes/config.js";
import { fs } from "./routes/fs.js";
import { skills as skillsRoute } from "./routes/skills.js";
import { git } from "./routes/git.js";
import { actions } from "./routes/actions.js";
import { proxy } from "./routes/proxy.js";
import { terminal, handlePtyWebSocket, ptyWebSocketHandlers } from "./routes/terminal.js";

const app = new Hono();

// CORS middleware — allow all in production (same-origin), Vite dev origin in dev
app.use(
  "*",
  cors({
    origin: process.env.NODE_ENV === "development" ? "http://localhost:5173" : "*",
  })
);

// Global error handler
app.onError((err, c) => {
  const status = ("status" in err ? err.status : 500) as ContentfulStatusCode;
  return c.json({ error: err.message, code: status }, status);
});

app.get("/", (c) => {
  return c.json({ message: "Coodeen server running" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Session CRUD routes
app.route("/api/sessions", sessions);

// Chat SSE endpoint
app.route("/api/chat", chat);

// Provider configuration routes
app.route("/api/providers", providers);

// Config routes (active provider, etc.)
app.route("/api/config", configRoutes);

// Filesystem browsing
app.route("/api/fs", fs);

// Skills management
app.route("/api/skills", skillsRoute);

// Git management
app.route("/api/git", git);

// Actions
app.route("/api/actions", actions);

// Terminal (PTY)
app.route("/api/terminal", terminal);

// Editor (built dist)
app.route("/", proxy);

// Named export for CLI / Node.js usage
export { app };
export { Pty } from "./pty/index.js";
export type { PtySocket } from "./pty/index.js";

// Bun dev server — default export used by `bun run src/index.ts`
const port = Number(process.env.PORT) || 3099;
export default {
  port,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch(req: Request, server: any) {
    server.timeout(req, 0);
    // Handle WebSocket upgrade for PTY connections
    const wsResponse = handlePtyWebSocket(req, server);
    if (wsResponse === undefined && new URL(req.url).pathname.match(/^\/api\/terminal\/[^/]+\/ws$/)) {
      // Upgrade succeeded, Bun handles the rest
      return;
    }
    if (wsResponse) return wsResponse;
    return app.fetch(req);
  },
  websocket: ptyWebSocketHandlers,
};
