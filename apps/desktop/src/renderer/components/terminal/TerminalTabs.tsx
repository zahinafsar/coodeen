import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { TerminalView } from "./TerminalView";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  cwd: string;
  label: string;
}

interface TerminalTabsProps {
  projectDir: string;
}

function basename(p: string): string {
  if (!p) return "terminal";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) || "/" : trimmed;
}

let counter = 0;
const newId = () => `t${Date.now().toString(36)}${counter++}`;

export function TerminalTabs({ projectDir }: TerminalTabsProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastDir = useRef<string>("");

  // When projectDir changes: reuse an existing tab for that dir, else create one.
  useEffect(() => {
    if (!projectDir) return;
    if (lastDir.current === projectDir) return;
    lastDir.current = projectDir;
    setTabs((prev) => {
      const existing = prev.find((t) => t.cwd === projectDir);
      if (existing) {
        setActiveId(existing.id);
        return prev;
      }
      const id = newId();
      setActiveId(id);
      return [...prev, { id, cwd: projectDir, label: basename(projectDir) }];
    });
  }, [projectDir]);

  const addTab = useCallback(() => {
    if (!projectDir) return;
    const id = newId();
    setTabs((prev) => [...prev, { id, cwd: projectDir, label: basename(projectDir) }]);
    setActiveId(id);
  }, [projectDir]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeId) {
          setActiveId(next.length ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [activeId],
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex items-center border-b bg-card shrink-0 overflow-x-auto">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center gap-1 pl-3 pr-1 h-8 text-xs border-r border-border cursor-pointer select-none",
              t.id === activeId
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveId(t.id)}
          >
            <span className="font-mono truncate max-w-[160px]">{t.label}</span>
            <button
              type="button"
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
              aria-label="Close terminal"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addTab}
          className="px-2 h-8 text-muted-foreground hover:text-foreground"
          aria-label="New terminal"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative">
        {tabs.map((t) => (
          <div
            key={t.id}
            className="absolute inset-0"
            style={{ visibility: t.id === activeId ? "visible" : "hidden" }}
          >
            <TerminalView cwd={t.cwd} active={t.id === activeId} />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Select a project folder to open a terminal.
          </div>
        )}
      </div>
    </div>
  );
}
