import type { ToolCall } from "../../lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRight,
  FileText,
  Search,
  Pencil,
  FilePlus,
  Loader2,
  Terminal,
  Globe,
  Code,
  Link,
  Image,
  ListChecks,
  Circle,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Tool metadata ────────────────────────────────────────

type ToolMeta = {
  icon: React.ElementType;
  label: string;
  color: string;
};

const ICON_COLOR = "text-muted-foreground";

const TOOL_META: Record<string, ToolMeta> = {
  read: { icon: FileText, label: "Read", color: ICON_COLOR },
  glob: { icon: Search, label: "Glob", color: ICON_COLOR },
  grep: { icon: Search, label: "Grep", color: ICON_COLOR },
  edit: { icon: Pencil, label: "Edit", color: ICON_COLOR },
  write: { icon: FilePlus, label: "Write", color: ICON_COLOR },
  webfetch: { icon: Link, label: "Fetch URL", color: ICON_COLOR },
  websearch: { icon: Globe, label: "Web Search", color: ICON_COLOR },
  codesearch: { icon: Code, label: "Code Search", color: ICON_COLOR },
  imagefetch: { icon: Image, label: "Fetch Image", color: ICON_COLOR },
  todo_write: { icon: ListChecks, label: "Plan", color: ICON_COLOR },
  todo_read: { icon: ListChecks, label: "Plan", color: ICON_COLOR },
};

type TodoItem = { content: string; status: "pending" | "in_progress" | "completed" };

function extractTodos(tc: ToolCall): TodoItem[] | null {
  if (tc.name !== "todo_write") return null;
  const input = tc.input as { todos?: unknown };
  if (!input || !Array.isArray(input.todos)) return null;
  return input.todos.filter(
    (t): t is TodoItem =>
      !!t &&
      typeof t === "object" &&
      typeof (t as TodoItem).content === "string" &&
      ["pending", "in_progress", "completed"].includes((t as TodoItem).status),
  );
}

const DEFAULT_META: ToolMeta = {
  icon: Terminal,
  label: "",
  color: "text-muted-foreground",
};

function getMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? { ...DEFAULT_META, label: name };
}

// ── Smart subtitle extraction ────────────────────────────

function getInput(tc: ToolCall): Record<string, unknown> {
  if (tc.input && typeof tc.input === "object" && !Array.isArray(tc.input)) {
    return tc.input as Record<string, unknown>;
  }
  return {};
}

function getSubtitle(tc: ToolCall): string {
  const input = getInput(tc);

  switch (tc.name) {
    case "read":
      return String(input.file_path ?? "");
    case "glob":
      return String(input.pattern ?? "");
    case "grep":
      return String(input.pattern ?? "");
    case "edit":
      return String(input.file_path ?? "");
    case "write":
      return String(input.file_path ?? "");
    case "webfetch":
      return String(input.url ?? "");
    case "websearch":
      return String(input.query ?? "");
    case "codesearch":
      return String(input.query ?? "");
    case "imagefetch":
      return String(input.url ?? "");
    default:
      return "";
  }
}

function getTags(tc: ToolCall): string[] {
  const input = getInput(tc);
  const tags: string[] = [];

  switch (tc.name) {
    case "read":
      if (input.offset) tags.push(`offset=${input.offset}`);
      if (input.limit) tags.push(`limit=${input.limit}`);
      break;
    case "grep":
      if (input.path) tags.push(String(input.path));
      break;
  }
  return tags;
}

function getOutputSummary(tc: ToolCall): string {
  if (tc.output === undefined) return "";
  const out =
    typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output);

  switch (tc.name) {
    case "glob": {
      if (out === "No files matched the pattern.") return "0 matches";
      const count = out.split("\n").filter(Boolean).length;
      return `${count} match${count === 1 ? "" : "es"}`;
    }
    case "grep": {
      if (out === "No matches found.") return "0 matches";
      const count = out.split("\n").filter(Boolean).length;
      return `${count} match${count === 1 ? "" : "es"}`;
    }
    default:
      return "";
  }
}

// ── Component ────────────────────────────────────────────

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const hasOutput = toolCall.output !== undefined;
  const meta = getMeta(toolCall.name);
  const Icon = meta.icon;
  const subtitle = getSubtitle(toolCall);
  const tags = getTags(toolCall);
  const outputSummary = getOutputSummary(toolCall);

  const todos = extractTodos(toolCall);
  if (todos && todos.length > 0) {
    const done = todos.filter((t) => t.status === "completed").length;
    return (
      <div>
        <div className="flex items-center gap-2 py-1.5 text-xs">
          <ListChecks className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">Plan</span>
          <span className="ml-auto text-muted-foreground">
            {done} / {todos.length} done
          </span>
        </div>
        <ul className="space-y-1.5 pb-1">
          {todos.map((t, i) => {
            const StatusIcon =
              t.status === "completed"
                ? CheckCircle2
                : t.status === "in_progress"
                  ? CircleDot
                  : Circle;
            const iconClass =
              t.status === "completed"
                ? "text-emerald-400"
                : t.status === "in_progress"
                  ? "text-amber-400"
                  : "text-muted-foreground/50";
            return (
              <li key={i} className="flex items-start gap-2 text-xs">
                <StatusIcon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", iconClass)} />
                <span
                  className={cn(
                    "leading-relaxed",
                    t.status === "completed" && "line-through text-muted-foreground",
                    t.status === "in_progress" && "text-foreground font-medium",
                    t.status === "pending" && "text-foreground/70",
                  )}
                >
                  {t.content}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const outputStr =
    toolCall.output === undefined
      ? ""
      : typeof toolCall.output === "string"
        ? toolCall.output
        : JSON.stringify(toolCall.output, null, 2);

  const imageOutput =
    toolCall.name === "imagefetch" && toolCall.output && typeof toolCall.output === "object"
      ? (toolCall.output as { base64?: string; mime?: string })
      : null;
  const imageDataUrl =
    imageOutput?.base64 && imageOutput?.mime
      ? `data:${imageOutput.mime};base64,${imageOutput.base64}`
      : null;

  const hasExpandableContent = hasOutput && outputStr.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-2 w-full py-1.5 rounded-md text-xs transition-colors text-left group",
          "hover:bg-accent/50",
          hasExpandableContent ? "cursor-pointer" : "cursor-default",
        )}
      >
        {/* Status icon */}
        {hasOutput ? (
          <Icon className={cn("w-3.5 h-3.5 shrink-0", meta.color)} />
        ) : (
          <Loader2 className={cn("w-3.5 h-3.5 shrink-0 animate-spin", meta.color)} />
        )}

        {/* Tool icon + name */}
        <span
          className={cn(
            "font-medium shrink-0",
            hasOutput ? "text-foreground/70" : "text-foreground",
          )}
        >
          {meta.label}
        </span>

        {/* Subtitle (file path, pattern, etc.) */}
        {subtitle && (
          <span className="text-muted-foreground truncate font-mono">
            {subtitle}
          </span>
        )}

        {/* Parameter tags */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="shrink-0 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono"
          >
            {tag}
          </span>
        ))}

        {/* Right side: summary + chevron */}
        <span className="flex items-center gap-1.5 shrink-0 ml-auto">
          {outputSummary && (
            <span className="text-muted-foreground">{outputSummary}</span>
          )}
          {hasExpandableContent && (
            <ChevronRight
              className={cn(
                "w-3 h-3 text-muted-foreground/50 transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </span>
      </CollapsibleTrigger>

      {hasExpandableContent && (
        <CollapsibleContent>
          {imageDataUrl ? (
            <div className="mx-2 mb-1.5">
              <img
                src={imageDataUrl}
                alt="Fetched image"
                className="rounded-md max-w-full max-h-[240px] object-contain"
              />
            </div>
          ) : (
            <pre className="mx-2 mb-1.5 font-mono text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[240px] overflow-y-auto leading-relaxed">
              {outputStr}
            </pre>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
