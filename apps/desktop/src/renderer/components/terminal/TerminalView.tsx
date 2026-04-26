import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { api } from "../../lib/api";

interface TerminalSession {
  id: string;
  title: string;
}

interface TerminalViewProps {
  cwd: string;
  active: boolean;
}

export function TerminalView({ cwd, active }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<TerminalSession | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);
  const [error, setError] = useState<string | null>(null);

  const initTerminal = useCallback(async () => {
    if (!containerRef.current) return;

    terminalRef.current?.dispose();
    cleanupRef.current.forEach((fn) => fn());
    cleanupRef.current = [];

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#27272a",
        black: "#18181b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#e4e4e7",
        brightBlack: "#52525b",
        brightRed: "#f87171",
        brightGreen: "#4ade80",
        brightYellow: "#facc15",
        brightBlue: "#60a5fa",
        brightMagenta: "#c084fc",
        brightCyan: "#22d3ee",
        brightWhite: "#fafafa",
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch {}

    try {
      const session = await api.createTerminal({ cwd });
      sessionRef.current = session;

      const { cols, rows } = terminal;
      await api.resizeTerminal(session.id, cols, rows);

      const removeDataListener = window.electronAPI.pty.onData((msg) => {
        if (msg.id === session.id) terminal.write(msg.data);
      });
      cleanupRef.current.push(removeDataListener);

      const removeExitListener = window.electronAPI.pty.onExit(() => {});
      cleanupRef.current.push(removeExitListener);

      const disposeOnData = terminal.onData((data) => {
        window.electronAPI.pty.write(session.id, data);
      });
      cleanupRef.current.push(() => disposeOnData.dispose());

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create terminal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    initTerminal();
    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
      if (sessionRef.current) {
        api.deleteTerminal(sessionRef.current.id).catch(() => {});
      }
      terminalRef.current?.dispose();
    };
  }, [initTerminal]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
          const { cols, rows } = terminalRef.current;
          if (sessionRef.current) {
            api.resizeTerminal(sessionRef.current.id, cols, rows).catch(() => {});
          }
        } catch {}
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Refit when this view becomes active (size may have been 0 while hidden).
  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => {
      try {
        fitAddonRef.current?.fit();
        const t = terminalRef.current;
        if (t && sessionRef.current) {
          api
            .resizeTerminal(sessionRef.current.id, t.cols, t.rows)
            .catch(() => {});
        }
        t?.focus();
      } catch {}
    });
  }, [active]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {error && (
        <div className="px-3 py-1.5 text-xs text-red-400 bg-red-950/50 border-b border-red-900/50">
          {error}
          <button
            type="button"
            onClick={initTerminal}
            className="ml-2 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
}
