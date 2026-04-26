import { memo, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { RotateCw } from "lucide-react";

export interface PageNodeData {
  route: string;
  url: string;
  [key: string]: unknown;
}

export const PageNode = memo(function PageNode({ data }: NodeProps) {
  const { route, url } = data as PageNodeData;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="bg-card border border-border rounded-md shadow-md overflow-hidden flex flex-col w-[1280px] h-[800px]">
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border shrink-0 cursor-grab active:cursor-grabbing">
        <span className="text-xs font-mono text-muted-foreground truncate">
          {route}
        </span>
        <button
          type="button"
          className="nodrag p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            const el = iframeRef.current;
            if (!el) return;
            const src = el.src;
            el.src = "";
            requestAnimationFrame(() => {
              if (iframeRef.current) iframeRef.current.src = src;
            });
          }}
          aria-label="Reload"
        >
          <RotateCw className="h-3 w-3" />
        </button>
      </div>
      <div className="page-node-iframe-host flex-1 min-h-0 bg-background">
        <iframe
          ref={iframeRef}
          src={url}
          title={route}
          className="w-full h-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});
