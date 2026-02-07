import { createServer, request as httpRequest } from "node:http";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer } from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function findInSource(projectRoot, className, id, textContent, style) {
  const entries = await readdir(projectRoot, { recursive: true });
  const sourceFiles = entries.filter(f =>
    /\.(tsx|jsx)$/.test(f) && !f.includes("node_modules") && !f.includes(".next")
  );

  const queries = [];
  if (textContent && textContent.length >= 3) queries.push(textContent.slice(0, 60));
  if (id) queries.push(id);
  if (style) {
    const styleBit = style.split(";")[0].split(":").pop()?.trim();
    if (styleBit && styleBit.length >= 8) queries.push(styleBit);
  }
  if (className) {
    const clean = className.split(/\s+/).filter(c => !c.includes("__") && !/^[a-f0-9]{6,}$/.test(c));
    if (clean.length > 0) queries.push(clean.join(" "));
  }

  for (const query of queries) {
    for (const file of sourceFiles) {
      try {
        const content = await readFile(join(projectRoot, file), "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            return { file, line: i + 1 };
          }
        }
      } catch {}
    }
  }
  return null;
}

export async function startServer({ targetPort, editorPort, projectRoot }) {
  const sessionDir = join(projectRoot, ".nocodevibe");
  const sessionFile = join(sessionDir, "session.json");

  await mkdir(sessionDir, { recursive: true });

  let session = { sessionId: null, messages: [] };

  async function loadSession() {
    try {
      const data = await readFile(sessionFile, "utf-8");
      session = JSON.parse(data);
    } catch {}
  }

  async function saveSession() {
    await writeFile(sessionFile, JSON.stringify(session, null, 2));
  }

  await loadSession();

  const SELECTOR_SCRIPT = `<script src="http://localhost:${editorPort}/selector.js"></script>`;

  const configScript = `<script>window.__NOCODEVIBE__=${JSON.stringify({ targetPort, editorPort })}</script>`;

  const server = createServer(async (req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      try {
        let html = await readFile(join(__dirname, "index.html"), "utf-8");
        html = html.replace("</head>", configScript + "</head>");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch {
        res.writeHead(500);
        res.end("Failed to load editor");
      }
    } else if (req.url === "/selector.js") {
      try {
        const js = await readFile(join(__dirname, "selector.js"), "utf-8");
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(js);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    } else if (req.url.startsWith("/find-source")) {
      const url = new URL(req.url, `http://localhost:${editorPort}`);
      const className = url.searchParams.get("className");
      const id = url.searchParams.get("id");
      const textContent = url.searchParams.get("text");
      const style = url.searchParams.get("style");
      try {
        const result = await findInSource(projectRoot, className, id, textContent, style);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end("null");
      }
    } else if (req.url === "/preview") {
      try {
        const resp = await fetch(`http://localhost:${targetPort}`);
        let html = await resp.text();
        const hmrFix = `<script>(() => {
          const OrigWS = window.WebSocket;
          window.WebSocket = function(url, protocols) {
            if (typeof url === 'string' && url.includes('/_next/webpack-hmr')) {
              url = url.replace('localhost:${editorPort}', 'localhost:${targetPort}');
            }
            return new OrigWS(url, protocols);
          };
          window.WebSocket.prototype = OrigWS.prototype;
          Object.assign(window.WebSocket, OrigWS);
        })();</script>`;
        html = html.replace(/<head([^>]*)>/i, '<head$1>' + hmrFix);
        html = html.replace(/<\/body>/i, SELECTOR_SCRIPT + '</body>');
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch (err) {
        res.writeHead(502);
        res.end("Failed to fetch preview: " + err.message);
      }
    } else {
      const proxyReq = httpRequest(
        { hostname: "localhost", port: targetPort, path: req.url, method: req.method, headers: { ...req.headers, host: `localhost:${targetPort}` } },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on("error", () => {
        res.writeHead(502);
        res.end("Proxy error");
      });
      req.pipe(proxyReq);
    }
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let activeProcess = null;
    let currentAssistantText = "";

    if (session.messages.length > 0) {
      ws.send(JSON.stringify({ type: "history", messages: session.messages }));
    }

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }

      if (msg.type === "prompt" && msg.text) {
        if (activeProcess) {
          activeProcess.kill("SIGTERM");
          activeProcess = null;
        }

        const prompt = msg.text;
        currentAssistantText = "";

        session.messages.push({ role: "user", text: prompt });
        saveSession();

        ws.send(JSON.stringify({ type: "start" }));

        const args = [
          "--dangerously-skip-permissions",
          "-p",
          prompt,
          "--verbose",
          "--output-format",
          "stream-json",
        ];
        if (session.sessionId) args.push("--resume", session.sessionId);

        const proc = spawn("claude", args, {
          cwd: projectRoot,
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        activeProcess = proc;

        proc.stdout.on("data", (chunk) => {
          const lines = chunk.toString().split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "system" && parsed.subtype === "init" && parsed.session_id) {
                session.sessionId = parsed.session_id;
              }
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                currentAssistantText += parsed.delta.text;
              }
              if (parsed.type === "assistant" && parsed.message?.content) {
                for (const block of parsed.message.content) {
                  if (block.type === "text" && block.text) {
                    currentAssistantText += block.text;
                  }
                }
              }
              ws.send(JSON.stringify({ type: "claude", data: parsed }));
            } catch {
              ws.send(JSON.stringify({ type: "text", data: line }));
            }
          }
        });

        proc.stderr.on("data", (chunk) => {
          ws.send(JSON.stringify({ type: "error", data: chunk.toString() }));
        });

        proc.on("close", (code) => {
          activeProcess = null;
          if (currentAssistantText) {
            session.messages.push({ role: "assistant", text: currentAssistantText });
          }
          saveSession();
          ws.send(JSON.stringify({ type: "done", code }));
        });

        proc.on("error", (err) => {
          activeProcess = null;
          ws.send(JSON.stringify({ type: "error", data: err.message }));
        });
      } else if (msg.type === "new-session") {
        session = { sessionId: null, messages: [] };
        saveSession();
      }
    });

    ws.on("close", () => {
      if (activeProcess) {
        activeProcess.kill("SIGTERM");
        activeProcess = null;
      }
    });
  });

  server.listen(editorPort, () => {
    const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
    const green = (s) => `\x1b[32m${s}\x1b[0m`;
    const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
    const bold = (s) => `\x1b[1m${s}\x1b[0m`;
    const dim = (s) => `\x1b[2m${s}\x1b[0m`;

    console.log();
    console.log(`  ${bold(cyan('nocodevibe'))} ${dim('v0.1.0')}`);
    console.log();
    console.log(`  ${green('>')} Editor    ${dim('http://localhost:')}${bold(`${editorPort}`)}`);
    console.log(`  ${green('>')} Target    ${dim('http://localhost:')}${bold(`${targetPort}`)}`);
    console.log();
    console.log(`  ${yellow('!')} Make sure your app is running on port ${bold(`${targetPort}`)}`);
    console.log();
  });
}
