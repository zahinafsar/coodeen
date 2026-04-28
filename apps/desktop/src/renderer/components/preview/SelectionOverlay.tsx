import { useCallback, useEffect, useRef, useState } from "react";
import { MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ElementInfo {
  tag: string;
  id: string;
  classes: string[];
  text: string;
  html: string;
  selector: string;
  screenshot?: string;
  route?: string;
}

interface SelectionOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  onElementSelected: (info: ElementInfo) => void;
}

function getDoc(iframe: HTMLIFrameElement | null): Document | null {
  try {
    return iframe?.contentDocument ?? null;
  } catch {
    return null;
  }
}

function buildSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = Array.from(el.classList).join(".");
  return cls ? `${tag}.${cls}` : tag;
}

function injectOverlays(doc: Document) {
  if (doc.getElementById("__coodeen_hl__")) return;
  const hl = doc.createElement("div");
  hl.id = "__coodeen_hl__";
  hl.style.cssText =
    "position:fixed;pointer-events:none;z-index:999999;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);transition:all 50ms;display:none;";
  doc.body.appendChild(hl);
  const tt = doc.createElement("div");
  tt.id = "__coodeen_tt__";
  tt.style.cssText =
    "position:fixed;pointer-events:none;z-index:999999;background:#1e1e2e;color:#cdd6f4;font:11px monospace;padding:3px 8px;border-radius:4px;white-space:nowrap;display:none;";
  doc.body.appendChild(tt);
}

function removeOverlays(doc: Document | null) {
  doc?.getElementById("__coodeen_hl__")?.remove();
  doc?.getElementById("__coodeen_tt__")?.remove();
}

export function SelectionOverlay({
  iframeRef,
  previewContainerRef,
  onElementSelected,
}: SelectionOverlayProps) {
  const [active, setActive] = useState(false);
  const lastEl = useRef<Element | null>(null);

  const reset = useCallback(() => {
    removeOverlays(getDoc(iframeRef.current));
    lastEl.current = null;
    setActive(false);
  }, [iframeRef]);

  const toggle = useCallback(() => {
    if (active) {
      reset();
    } else {
      const doc = getDoc(iframeRef.current);
      if (doc) injectOverlays(doc);
      setActive(true);
    }
  }, [active, reset, iframeRef]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") reset(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, reset]);

  const toIframeCoords = useCallback(
    (e: React.MouseEvent) => {
      const rect = iframeRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [iframeRef],
  );

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = toIframeCoords(e);
      const doc = getDoc(iframeRef.current);
      if (!coords || !doc) return;

      const el = doc.elementFromPoint(coords.x, coords.y);
      if (!el || el.id === "__coodeen_hl__" || el.id === "__coodeen_tt__") return;
      lastEl.current = el;

      const hl = doc.getElementById("__coodeen_hl__");
      const tt = doc.getElementById("__coodeen_tt__");
      if (!hl || !tt) return;

      const r = el.getBoundingClientRect();
      hl.style.left = `${r.left}px`;
      hl.style.top = `${r.top}px`;
      hl.style.width = `${r.width}px`;
      hl.style.height = `${r.height}px`;
      hl.style.display = "block";

      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).join(".")
        : "";
      tt.textContent = `${tag}${id}${cls}`;
      tt.style.left = `${r.left}px`;
      tt.style.top = `${Math.max(0, r.top - 22)}px`;
      tt.style.display = "block";
    },
    [iframeRef, toIframeCoords],
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      const el = lastEl.current as HTMLElement | null;
      const iframe = iframeRef.current;
      if (!el || !iframe) return;

      // Hide highlight before capture
      const doc = getDoc(iframe);
      const hl = doc?.getElementById("__coodeen_hl__");
      const tt = doc?.getElementById("__coodeen_tt__");
      if (hl) hl.style.display = "none";
      if (tt) tt.style.display = "none";

      // Wait a frame for highlight to disappear
      await new Promise((r) => requestAnimationFrame(r));

      // Capture the element area via Electron's native capturePage
      let screenshot: string | undefined;
      try {
        const elRect = el.getBoundingClientRect();
        const iframeRect = iframe.getBoundingClientRect();
        const pad = 4;
        screenshot =
          (await window.electronAPI.captureArea(
            iframeRect.left + elRect.left - pad,
            iframeRect.top + elRect.top - pad,
            elRect.width + pad * 2,
            elRect.height + pad * 2,
          )) ?? undefined;
      } catch {}

      onElementSelected({
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        classes: el.className && typeof el.className === "string"
          ? el.className.trim().split(/\s+/).filter(Boolean)
          : [],
        text: (el.textContent || "").trim().slice(0, 200),
        html: el.outerHTML.slice(0, 500),
        selector: buildSelector(el),
        screenshot,
      });
      reset();
    },
    [onElementSelected, reset, iframeRef],
  );

  return (
    <>
      <Button
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className={cn("h-8 w-8 shrink-0", active && "bg-blue-950 text-blue-400 hover:bg-blue-900")}
        onClick={toggle}
        aria-label={active ? "Cancel element selection" : "Select element"}
      >
        <MousePointer className="h-4 w-4" />
      </Button>

      {active && previewContainerRef.current && (
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: "crosshair" }}
          onMouseMove={handleMove}
          onClick={handleClick}
        />
      )}
    </>
  );
}
