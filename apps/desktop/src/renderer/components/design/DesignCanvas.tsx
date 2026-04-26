import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "../../lib/api";
import type { CoodeenConfig } from "../../lib/types";
import { PageNode, type PageNodeData } from "./PageNode";
import { DesignErrorBoundary } from "./DesignErrorBoundary";

interface DesignCanvasProps {
  projectDir: string;
  onGenerate: () => void;
  generating: boolean;
}

const NODE_GAP = 60;
const NODE_W = 1280;
const NODE_H = 800;
const COLS = 3;

function makeNodes(cfg: CoodeenConfig): Node<PageNodeData>[] {
  const { host, pages } = cfg.design;
  return pages.map((p, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      id: p.route,
      type: "page",
      position: {
        x: typeof p.x === "number" ? p.x : col * (NODE_W + NODE_GAP),
        y: typeof p.y === "number" ? p.y : row * (NODE_H + NODE_GAP),
      },
      data: {
        route: p.route,
        url: `${host.replace(/\/$/, "")}${p.route.startsWith("/") ? p.route : `/${p.route}`}`,
      },
      draggable: true,
    };
  });
}

function nodesToConfig(
  cfg: CoodeenConfig,
  nodes: Node<PageNodeData>[],
): CoodeenConfig {
  const byRoute = new Map(nodes.map((n) => [n.id, n]));
  const updated = cfg.design.pages.map((p) => {
    const n = byRoute.get(p.route);
    if (!n) return p;
    return { ...p, x: n.position.x, y: n.position.y };
  });
  return { ...cfg, design: { ...cfg.design, pages: updated } };
}

function DesignCanvasInner({
  projectDir,
  onGenerate,
  generating,
}: DesignCanvasProps) {
  const [config, setConfig] = useState<CoodeenConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node<PageNodeData>[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!projectDir) {
      setConfig(null);
      setNodes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const cfg = await api.getCoodeen(projectDir);
      setConfig(cfg);
      setNodes(cfg ? makeNodes(cfg) : []);
    } finally {
      setLoading(false);
    }
  }, [projectDir]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!projectDir) return;
    api.watchCoodeen(projectDir).catch(() => {});
    const off = api.onCoodeenChanged(({ dir }) => {
      if (dir === projectDir) load();
    });
    return () => off();
  }, [projectDir, load]);

  const persist = useCallback(
    (next: Node<PageNodeData>[]) => {
      if (!config || !projectDir) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const updated = nodesToConfig(config, next);
        api.setCoodeen(projectDir, updated).catch(() => {});
      }, 300);
    },
    [config, projectDir],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((curr) => {
        const next = applyNodeChanges(changes, curr) as Node<PageNodeData>[];
        const dragged = changes.some(
          (c) => c.type === "position" && c.dragging === false,
        );
        if (dragged) persist(next);
        return next;
      });
    },
    [persist],
  );

  const nodeTypes: NodeTypes = useMemo(() => ({ page: PageNode }), []);

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

  if (!config) {
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
    <div className="relative h-full w-full bg-[#0a0a0a]">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
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
        selectionOnDrag={false}
        onlyRenderVisibleElements
      >
        <Background gap={24} size={1} />
        <Controls position="bottom-right" />
        <MiniMap pannable zoomable position="bottom-left" />
      </ReactFlow>
    </div>
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
