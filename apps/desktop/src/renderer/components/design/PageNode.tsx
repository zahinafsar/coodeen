import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Maximize2, Minimize2, RotateCw } from "lucide-react";
import { useDesignSelect } from "./DesignSelectContext";
import { useDesignPage, useDesignPrefs } from "./DesignPrefsContext";
import type { ElementInfo } from "../preview/SelectionOverlay";

export interface PageNodeData {
  route: string;
  url: string;
  [key: string]: unknown;
}

const DEFAULT_HEIGHT = 1080;
const HEADER_HEIGHT = 33;
const MAX_HEIGHT = 10000;

const HL_ID = "__coodeen_hl__";
const TT_ID = "__coodeen_tt__";

function injectOverlays(doc: Document) {
  if (doc.getElementById(HL_ID)) return;
  const hl = doc.createElement("div");
  hl.id = HL_ID;
  hl.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);transition:all 50ms;display:none;";
  doc.body.appendChild(hl);
  const tt = doc.createElement("div");
  tt.id = TT_ID;
  tt.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483647;background:#1e1e2e;color:#cdd6f4;font:11px monospace;padding:3px 8px;border-radius:4px;white-space:nowrap;display:none;";
  doc.body.appendChild(tt);
}

function removeOverlays(doc: Document | null) {
  doc?.getElementById(HL_ID)?.remove();
  doc?.getElementById(TT_ID)?.remove();
}

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).join(".");
  return cls ? `${tag}.${cls}` : tag;
}

export const PageNode = memo(function PageNode({ data }: NodeProps) {
  const { route, url } = data as PageNodeData;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(DEFAULT_HEIGHT);
  const page = useDesignPage(route);
  const prefs = useDesignPrefs();
  const compact = !!page?.compact;
  const bodyHeight = compact ? DEFAULT_HEIGHT : measuredHeight;
  const lastEl = useRef<Element | null>(null);
  const { mode, onSelected } = useDesignSelect();

  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const measureOnce = () => {
      if (cancelled) return;
      const doc = el.contentDocument;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0,
      );
      if (h <= 0) return;
      const clamped = Math.min(h, MAX_HEIGHT);
      setMeasuredHeight(clamped);
    };

    const onLoad = () => {
      measureOnce();
      timer = setTimeout(measureOnce, 800);
    };
    el.addEventListener("load", onLoad);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      el.removeEventListener("load", onLoad);
    };
  }, []);

  // Inject / remove highlight scaffolding inside iframe based on mode.
  useEffect(() => {
    const el = iframeRef.current;
    const doc = el?.contentDocument ?? null;
    if (!doc) return;
    if (mode === "select") injectOverlays(doc);
    else removeOverlays(doc);
    return () => removeOverlays(doc);
  }, [mode]);

  const toIframeCoords = useCallback((e: React.MouseEvent) => {
    const iframe = iframeRef.current;
    if (!iframe) return null;
    const rect = iframe.getBoundingClientRect();
    const scaleX = rect.width / (iframe.offsetWidth || rect.width);
    const scaleY = rect.height / (iframe.offsetHeight || rect.height);
    return {
      x: (e.clientX - rect.left) / (scaleX || 1),
      y: (e.clientY - rect.top) / (scaleY || 1),
      scaleX: scaleX || 1,
      scaleY: scaleY || 1,
      iframeRect: rect,
    };
  }, []);

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = toIframeCoords(e);
      const doc = iframeRef.current?.contentDocument;
      if (!coords || !doc) return;
      const el = doc.elementFromPoint(coords.x, coords.y);
      if (!el || el.id === HL_ID || el.id === TT_ID) return;
      lastEl.current = el;
      const hl = doc.getElementById(HL_ID);
      const tt = doc.getElementById(TT_ID);
      if (!hl || !tt) return;
      const r = el.getBoundingClientRect();
      hl.style.left = `${r.left}px`;
      hl.style.top = `${r.top}px`;
      hl.style.width = `${r.width}px`;
      hl.style.height = `${r.height}px`;
      hl.style.display = "block";
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls =
        el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).join(".")
          : "";
      tt.textContent = `${tag}${id}${cls}`;
      tt.style.left = `${r.left}px`;
      tt.style.top = `${Math.max(0, r.top - 22)}px`;
      tt.style.display = "block";
    },
    [toIframeCoords],
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const iframe = iframeRef.current;
      const el = lastEl.current as HTMLElement | null;
      if (!iframe || !el) return;
      const doc = iframe.contentDocument;
      const hl = doc?.getElementById(HL_ID);
      const tt = doc?.getElementById(TT_ID);
      if (hl) hl.style.display = "none";
      if (tt) tt.style.display = "none";
      await new Promise((r) => requestAnimationFrame(r));

      let screenshot: string | undefined;
      try {
        const elRect = el.getBoundingClientRect();
        const iframeRect = iframe.getBoundingClientRect();
        const scaleX = iframeRect.width / (iframe.offsetWidth || iframeRect.width);
        const scaleY = iframeRect.height / (iframe.offsetHeight || iframeRect.height);
        const pad = 4;
        screenshot =
          (await window.electronAPI.captureArea(
            iframeRect.left + elRect.left * scaleX - pad,
            iframeRect.top + elRect.top * scaleY - pad,
            elRect.width * scaleX + pad * 2,
            elRect.height * scaleY + pad * 2,
          )) ?? undefined;
      } catch {}

      const info: ElementInfo = {
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        classes:
          el.className && typeof el.className === "string"
            ? el.className.trim().split(/\s+/).filter(Boolean)
            : [],
        text: (el.textContent || "").trim().slice(0, 200),
        html: el.outerHTML.slice(0, 500),
        selector: buildSelector(el),
        screenshot,
        route,
      };
      onSelected(info);
    },
    [onSelected, route],
  );

  return (
    <div
      className="bg-card border border-border rounded-md shadow-md overflow-hidden flex flex-col w-[1920px]"
      style={{ height: bodyHeight + HEADER_HEIGHT }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border shrink-0 cursor-grab active:cursor-grabbing">
        <span className="text-xs font-mono text-muted-foreground truncate">
          {route}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="nodrag p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              prefs.updatePage(route, { compact: !compact });
            }}
            aria-label={compact ? "Auto height" : "Lock to desktop height"}
            title={compact ? "Auto height" : "Lock to desktop height"}
          >
            {compact ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </button>
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
      </div>
      <div
        className="page-node-iframe-host bg-background relative"
        style={{ height: bodyHeight }}
      >
        <iframe
          ref={iframeRef}
          src={url}
          title={route}
          className="w-full border-0 block"
          style={{ height: bodyHeight }}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {mode === "select" && (
          <div
            ref={overlayRef}
            className="absolute inset-0 nodrag nopan nowheel"
            style={{ cursor: "crosshair", pointerEvents: "auto" }}
            onMouseMove={handleMove}
            onClick={handleClick}
            onPointerDownCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onWheelCapture={(e) => e.stopPropagation()}
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
});
