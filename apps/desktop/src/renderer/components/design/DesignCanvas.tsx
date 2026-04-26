import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Eye, Loader2, MousePointer2, MousePointerClick, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import type { CoodeenConfig } from "../../lib/types";
import { PageNode, type PageNodeData } from "./PageNode";
import { DesignErrorBoundary } from "./DesignErrorBoundary";
import { DesignSelectContext, type DesignMode } from "./DesignSelectContext";
import { DesignPrefsProvider } from "./DesignPrefsContext";
import { useElementSelection } from "../../contexts/ElementSelectionContext";
import { cn } from "@/lib/utils";

interface DesignCanvasProps {
  projectDir: string;
  onGenerate: () => void;
  generating: boolean;
}

const NODE_GAP = 60;
const NODE_W = 1920;

function buildNodes(cfg: CoodeenConfig): Node<PageNodeData>[] {
  if (!cfg.design) return [];
  const host = cfg.design.host;
  const pages = cfg.design.pages ?? [];
  return pages.map((p, i) => {
    const url = `${host.replace(/\/$/, "")}${p.route.startsWith("/") ? p.route : `/${p.route}`}`;
    return {
      id: p.route,
      type: "page",
      position: { x: i * (NODE_W + NODE_GAP), y: 0 },
      data: { route: p.route, url },
      draggable: false,
    };
  });
}

function DesignCanvasInner({
  projectDir,
  onGenerate,
  generating,
}: DesignCanvasProps) {
  const [config, setConfig] = useState<CoodeenConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DesignMode>("preview");
  const lastPersistedRef = useRef<string>("");
  const configRef = useRef<CoodeenConfig | null>(null);
  configRef.current = config;
  const { addScreenshot } = useElementSelection();

  const handleSelected = useCallback(
    (info: { screenshot?: string }) => {
      if (info.screenshot) addScreenshot(info.screenshot);
      setMode("preview");
    },
    [addScreenshot],
  );

  const ctx = useMemo(
    () => ({ mode, onSelected: handleSelected }),
    [mode, handleSelected],
  );

  const load = useCallback(
    async (initial: boolean) => {
      if (!projectDir) {
        setConfig(null);
        lastPersistedRef.current = "";
        if (initial) setLoading(false);
        return;
      }
      if (initial) setLoading(true);
      try {
        const cfg = await api.getCoodeen(projectDir);
        const json = JSON.stringify(cfg);
        // Skip setConfig if the on-disk content matches what we just
        // wrote ourselves — keeps React Flow + iframes from re-rendering.
        if (json === lastPersistedRef.current) return;
        lastPersistedRef.current = json;
        setConfig(cfg);
      } finally {
        if (initial) setLoading(false);
      }
    },
    [projectDir],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  useEffect(() => {
    if (!projectDir) return;
    api.watchCoodeen(projectDir).catch(() => {});
    const off = api.onCoodeenChanged(({ dir }) => {
      if (dir === projectDir) load(false);
    });
    return () => off();
  }, [projectDir, load]);

  const handleFlush = useCallback(
    (next: NonNullable<CoodeenConfig["design"]>) => {
      const cur = configRef.current;
      if (!cur || !projectDir) return;
      const merged: CoodeenConfig = { ...cur, design: next };
      lastPersistedRef.current = JSON.stringify(merged);
      api.setCoodeen(projectDir, merged).catch(() => {});
    },
    [projectDir],
  );

  const nodeTypes: NodeTypes = useMemo(() => ({ page: PageNode }), []);

  const nodes = useMemo(
    () => (config ? buildNodes(config) : []),
    [config],
  );

  if (!projectDir) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <p className="text-sm">Select a project folder first.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">Reading project, detecting routes…</p>
      </div>
    );
  }

  if (!config || !config.design) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          No design file found. Generate one to scan your project's routes and
          render them on the canvas.
        </p>
        <Button onClick={onGenerate} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate design file
        </Button>
      </div>
    );
  }

  return (
    <DesignSelectContext.Provider value={ctx}>
      <DesignPrefsProvider initial={config.design} onFlush={handleFlush}>
        <div
          className={cn(
            "relative h-full w-full bg-[#0a0a0a]",
            mode === "interact" && "canvas-interact",
          )}
        >
          <ReactFlow
            nodes={nodes}
            edges={[]}
            nodeTypes={nodeTypes}
            proOptions={{ hideAttribution: true }}
            colorMode="dark"
            minZoom={0.05}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            panOnScroll
            zoomOnPinch
            zoomOnScroll
            panOnDrag
            nodesDraggable={false}
            selectionOnDrag={false}
            onlyRenderVisibleElements
          >
            <Background gap={24} size={1} />
            <Controls position="bottom-right" />
            <MiniMap pannable zoomable position="bottom-left" />
          </ReactFlow>
          <div className="absolute top-3 left-3 flex items-center bg-card/80 border border-border rounded-md overflow-hidden text-[11px]">
            <ModeButton
              active={mode === "preview"}
              onClick={() => setMode("preview")}
              label="Preview"
              icon={<Eye className="h-3 w-3" />}
            />
            <ModeButton
              active={mode === "interact"}
              onClick={() => setMode("interact")}
              label="Interact"
              icon={<MousePointer2 className="h-3 w-3" />}
            />
            <ModeButton
              active={mode === "select"}
              onClick={() => setMode("select")}
              label="Select"
              icon={<MousePointerClick className="h-3 w-3" />}
              accent
            />
          </div>
        </div>
      </DesignPrefsProvider>
    </DesignSelectContext.Provider>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  icon,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 transition-colors",
        active
          ? accent
            ? "bg-blue-500/20 text-blue-200"
            : "bg-amber-500/15 text-amber-200"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

export function DesignCanvas(props: DesignCanvasProps) {
  return (
    <DesignErrorBoundary>
      <ReactFlowProvider>
        <DesignCanvasInner {...props} />
      </ReactFlowProvider>
    </DesignErrorBoundary>
  );
}
