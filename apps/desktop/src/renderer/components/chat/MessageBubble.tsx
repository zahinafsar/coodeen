import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import type {
  Message,
  Part,
  TextPart,
  ReasoningPart,
  FilePart,
  ToolPart,
} from "../../stores/chat-store";
import { usePacedText } from "../../hooks/usePacedText";
import {
  ChevronDown,
  Brain,
  FileText,
  Search,
  Pencil,
  FilePlus,
  Terminal,
  Globe,
  Link,
  Image as ImageIcon,
  ListChecks,
  Circle,
  CircleDot,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message & { parts: Part[] };
}

const BUBBLE =
  "max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm leading-relaxed break-words bg-muted text-foreground";

// ── Entry ─────────────────────────────────────────────────────────────────

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return <UserBubble message={message} />;
  }
  return <AssistantStack message={message} />;
}

// ── User ──────────────────────────────────────────────────────────────────

function UserBubble({ message }: { message: Message & { parts: Part[] } }) {
  const images = message.parts.filter(
    (p): p is FilePart =>
      p.type === "file" && (p as FilePart).mime?.startsWith("image/"),
  );
  const text = message.parts
    .filter((p): p is TextPart => p.type === "text" && !(p as TextPart).synthetic)
    .map((p) => p.text)
    .join("");

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed break-words bg-primary text-primary-foreground">
        {images.map((img) => (
          <img
            key={img.id}
            src={img.url}
            alt={img.filename ?? "attachment"}
            className="rounded-md max-w-full max-h-48 mb-2"
          />
        ))}
        {text && <div className="whitespace-pre-wrap">{text}</div>}
      </div>
    </div>
  );
}

// ── Assistant ─────────────────────────────────────────────────────────────

function AssistantStack({
  message,
}: {
  message: Message & { parts: Part[] };
}) {
  const visible = message.parts.filter(renderable);
  const isStreaming = typeof message.time.completed !== "number";

  if (visible.length === 0 && !isStreaming) return null;

  // Render tool parts as inline rows (grouped under a left rail).
  // Skip reasoning entirely. Text / image render as own bubbles.
  type Group =
    | { kind: "tools"; items: ToolPart[] }
    | { kind: "text"; part: TextPart }
    | { kind: "file"; part: FilePart };

  const groups: Group[] = [];
  for (const part of visible) {
    if (part.type === "reasoning") continue;
    const last = groups[groups.length - 1];
    if (part.type === "tool") {
      if (last && last.kind === "tools") last.items.push(part as ToolPart);
      else groups.push({ kind: "tools", items: [part as ToolPart] });
    } else if (part.type === "text") {
      groups.push({ kind: "text", part: part as TextPart });
    } else if (part.type === "file") {
      groups.push({ kind: "file", part: part as FilePart });
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 max-w-full w-[85%]">
      {groups.map((g, i) =>
        g.kind === "tools" ? (
          <div key={`tools-${i}`} className="w-full relative py-1">
            {/* vertical rail connecting all tool nodes */}
            <div
              className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-border rounded-full"
              aria-hidden
            />
            <div className="flex flex-col">
              {g.items.map((part) => (
                <ThreadTool key={part.id} part={part} />
              ))}
            </div>
          </div>
        ) : g.kind === "text" ? (
          <TextPartView
            key={g.part.id}
            part={g.part}
            isStreaming={isStreaming}
          />
        ) : (
          <ImagePartView key={g.part.id} part={g.part} />
        ),
      )}
      {visible.length === 0 && isStreaming && <ThinkingDots />}
    </div>
  );
}

function renderable(part: Part): boolean {
  if (part.type === "text") {
    const p = part as TextPart;
    if (p.synthetic) return false;
    if (p.ignored) return false;
    return (p.text ?? "").trim().length > 0;
  }
  if (part.type === "reasoning") {
    return (part as ReasoningPart).text?.trim().length > 0;
  }
  if (part.type === "tool") return true;
  if (part.type === "file") {
    return !!(part as FilePart).url;
  }
  return false;
}

// ── Chain of Thought ──────────────────────────────────────────────────────

function ChainOfThought({
  items,
  isStreaming,
  defaultOpen,
}: {
  items: Part[];
  isStreaming: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const running = isStreaming && items.length > 0;

  return (
    <div className="w-full rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group cursor-pointer">
          {running ? (
            <Loader2 className="w-4 h-4 shrink-0 text-muted-foreground animate-spin" />
          ) : (
            <Brain className="w-4 h-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-foreground/90">
            Chain of Thought
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {items.length} step{items.length === 1 ? "" : "s"}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 text-muted-foreground/60 transition-transform",
              !open && "-rotate-90",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 ml-1 border-l border-border/60 pl-3 space-y-2.5">
            {items.map((part) =>
              part.type === "reasoning" ? (
                <ThreadReasoning
                  key={part.id}
                  part={part as ReasoningPart}
                  isStreaming={isStreaming}
                />
              ) : part.type === "tool" ? (
                <ThreadTool key={part.id} part={part as ToolPart} />
              ) : null,
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ── Thread items ──────────────────────────────────────────────────────────

function ThreadReasoning({
  part,
  isStreaming,
}: {
  part: ReasoningPart;
  isStreaming: boolean;
}) {
  const paced = usePacedText(part.text ?? "", isStreaming);
  const [open, setOpen] = useState(false);
  // First markdown-bolded phrase or first line, used as the inline summary.
  const rawSummary =
    part.text?.match(/\*\*(.+?)\*\*/)?.[1] ??
    (paced.trim().split(/[.\n]/)[0] ?? "").slice(0, 100);
  const summary = rawSummary.trim();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-start gap-2 text-left w-full group cursor-pointer">
        <Brain className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground/90 italic leading-relaxed">
          {summary || "Reasoning"}
        </span>
      </CollapsibleTrigger>
      {paced.trim() && (
        <CollapsibleContent>
          <div className="mt-1.5 ml-5 text-xs text-muted-foreground whitespace-pre-wrap italic leading-relaxed">
            {paced}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

type ToolMeta = { icon: React.ElementType; ing: string; past: string };

const TOOL_META: Record<string, ToolMeta> = {
  bash: { icon: Terminal, ing: "Running", past: "Ran" },
  read: { icon: FileText, ing: "Reading", past: "Read" },
  glob: { icon: Search, ing: "Searching", past: "Searched" },
  grep: { icon: Search, ing: "Searching", past: "Searched" },
  edit: { icon: Pencil, ing: "Editing", past: "Edited" },
  write: { icon: FilePlus, ing: "Creating", past: "Created" },
  webfetch: { icon: Link, ing: "Fetching", past: "Fetched" },
  websearch: { icon: Globe, ing: "Searching web for", past: "Searched web for" },
  imagefetch: { icon: ImageIcon, ing: "Fetching image", past: "Fetched image" },
  todowrite: { icon: ListChecks, ing: "Planning", past: "Plan" },
  todoread: { icon: ListChecks, ing: "Reading plan", past: "Read plan" },
  apply_patch: { icon: Pencil, ing: "Applying patch", past: "Applied patch" },
};

function getToolMeta(name: string): ToolMeta {
  return (
    TOOL_META[name] ?? { icon: Terminal, ing: name, past: name }
  );
}

function toolSummary(part: ToolPart): string {
  const input = (part.state.input ?? {}) as Record<string, unknown>;
  switch (part.tool) {
    case "read":
    case "edit":
    case "write":
      return String(input.filePath ?? input.file_path ?? input.path ?? "");
    case "glob":
    case "grep":
      return String(input.pattern ?? "");
    case "webfetch":
    case "imagefetch":
      return String(input.url ?? "");
    case "websearch":
      return String(input.query ?? "");
    case "bash": {
      const c = String(input.command ?? "");
      return c.length > 120 ? c.slice(0, 120) + "…" : c;
    }
    default:
      return "";
  }
}

function toolTags(part: ToolPart): string[] {
  const input = (part.state.input ?? {}) as Record<string, unknown>;
  const tags: string[] = [];
  switch (part.tool) {
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

function toolOutputSummary(part: ToolPart): string {
  if (part.state.status !== "completed") return "";
  const out = part.state.output ?? "";
  switch (part.tool) {
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

type TodoItem = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

function extractTodos(part: ToolPart): TodoItem[] | null {
  if (part.tool !== "todowrite") return null;
  const input = part.state.input as { todos?: unknown } | undefined;
  if (!input || !Array.isArray(input.todos)) return null;
  return input.todos.filter(
    (t): t is TodoItem =>
      !!t &&
      typeof t === "object" &&
      typeof (t as TodoItem).content === "string" &&
      ["pending", "in_progress", "completed"].includes((t as TodoItem).status),
  );
}

function splitPath(p: string): { dir: string; name: string } {
  const idx = p.lastIndexOf("/");
  if (idx === -1) return { dir: "", name: p };
  return { dir: p.slice(0, idx + 1), name: p.slice(idx + 1) };
}

function isPathLike(tool: string): boolean {
  return tool === "read" || tool === "edit" || tool === "write";
}

function patchSummary(out: string): string {
  // Parse apply_patch output lines like "A path", "M path", "D path".
  const files = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[AMD]\s/.test(l));
  if (files.length === 0) return "";
  if (files.length === 1) return files[0].slice(2);
  return `${files.length} files`;
}

function ThreadTool({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const meta = getToolMeta(part.tool);
  const Icon = meta.icon;
  const status = part.state.status;
  const summary = toolSummary(part);
  const tags = toolTags(part);
  let outputSummary = toolOutputSummary(part);
  if (
    !outputSummary &&
    part.tool === "apply_patch" &&
    status === "completed"
  ) {
    outputSummary = patchSummary(part.state.output ?? "");
  }
  // unused columns removed
  void tags;

  // todowrite → visible checklist (no expand)
  const todos = extractTodos(part);
  if (todos && todos.length > 0) {
    const done = todos.filter((t) => t.status === "completed").length;
    return (
      <div>
        <div className="flex items-center gap-2 text-xs">
          <ListChecks className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground/90">Plan</span>
          <span className="ml-auto text-muted-foreground">
            {done} / {todos.length} done
          </span>
        </div>
        <ul className="mt-1.5 space-y-1">
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
                <StatusIcon
                  className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", iconClass)}
                />
                <span
                  className={cn(
                    "leading-relaxed",
                    t.status === "completed" &&
                      "line-through text-muted-foreground",
                    t.status === "in_progress" &&
                      "text-foreground font-medium",
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

  const LeadIcon =
    status === "pending" || status === "running"
      ? Loader2
      : status === "error"
        ? AlertCircle
        : Icon;
  const leadIconClass = cn(
    "w-3.5 h-3.5 mt-0.5 shrink-0",
    status === "pending" || status === "running"
      ? "animate-spin text-muted-foreground"
      : status === "error"
        ? "text-red-400"
        : "text-muted-foreground",
  );

  const outputStr =
    status === "completed"
      ? part.state.output ?? ""
      : status === "error"
        ? `Error: ${part.state.error}`
        : "";

  const canExpand = outputStr.length > 0;

  const path = isPathLike(part.tool) ? splitPath(summary) : null;
  const verb =
    status === "pending" || status === "running"
      ? meta.ing
      : status === "error"
        ? `${meta.past} (failed)`
        : meta.past;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group flex items-center gap-3 w-full text-left py-1.5 pr-2 relative",
          canExpand ? "cursor-pointer" : "cursor-default",
        )}
      >
        {/* Node marker — solid bg so it punches through the rail line */}
        <span
          className={cn(
            "relative z-10 w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-background border transition-colors",
            status === "error"
              ? "border-red-500/50 text-red-400/70 group-hover:text-red-400"
              : status === "pending" || status === "running"
                ? "border-amber-500/50 text-amber-400/70 group-hover:text-amber-400"
                : "border-border/60 text-muted-foreground group-hover:text-foreground/90 group-hover:border-border",
          )}
        >
          <LeadIcon className={cn(leadIconClass, "!mt-0 w-3 h-3")} />
        </span>
        <span className="text-[13px] leading-tight min-w-0 flex-1 truncate transition-colors">
          <span className="text-muted-foreground/70 font-medium group-hover:text-foreground/90">
            {verb}
          </span>
          {summary && <span>{" "}</span>}
          {path ? (
            <span className="font-mono">
              <span className="text-muted-foreground/40 group-hover:text-muted-foreground/60">
                {path.dir}
              </span>
              <span className="text-muted-foreground/70 group-hover:text-foreground">
                {path.name}
              </span>
            </span>
          ) : summary ? (
            <span className="font-mono text-muted-foreground/60 group-hover:text-foreground/80">
              {summary}
            </span>
          ) : null}
          {outputSummary && (
            <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70">
              {" · "}
              {outputSummary}
            </span>
          )}
        </span>
      </CollapsibleTrigger>
      {outputStr && (
        <CollapsibleContent>
          <div className="mt-1 mb-1 ml-10">
            <ToolOutput
              tool={part.tool}
              output={outputStr}
              isError={status === "error"}
            />
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ToolOutput({
  tool,
  output,
  isError,
}: {
  tool: string;
  output: string;
  isError: boolean;
}) {
  // For `read`, strip opencode's <path>/<type>/<content> wrapper so only
  // the file contents (with line numbers) show in the panel.
  let body = output;
  if (tool === "read" && !isError) {
    const m = output.match(/<content>\n?([\s\S]*?)(?:<\/content>|$)/);
    if (m) body = m[1].replace(/\s+$/, "");
  }
  return (
    <pre
      className={cn(
        "mt-0.5 font-mono text-[11px] rounded-md px-3 py-2 overflow-x-auto whitespace-pre max-h-[320px] overflow-y-auto leading-relaxed border",
        isError
          ? "text-red-300 bg-red-950/30 border-red-900/40"
          : "text-foreground/80 bg-[#0a0a0f] border-border/60",
      )}
    >
      {body}
    </pre>
  );
}

// ── Text + image parts ────────────────────────────────────────────────────

function TextPartView({
  part,
  isStreaming,
}: {
  part: TextPart;
  isStreaming: boolean;
}) {
  const paced = usePacedText(part.text ?? "", isStreaming);
  return (
    <div className={BUBBLE}>
      <div className="prose prose-invert prose-sm max-w-full prose-pre:bg-black/40 prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:overflow-x-auto prose-code:bg-black/30 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-code:break-words prose-a:text-blue-400 prose-a:break-words overflow-hidden">
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          remarkPlugins={[remarkGfm]}
        >
          {paced}
        </ReactMarkdown>
        {isStreaming && paced.length > 0 && paced.length < (part.text?.length ?? 0) && (
          <span className="inline-block w-2 h-4 bg-muted-foreground rounded-[1px] animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
}

function ReasoningPartView({
  part,
  isStreaming,
}: {
  part: ReasoningPart;
  isStreaming: boolean;
}) {
  const paced = usePacedText(part.text ?? "", isStreaming);
  const [open, setOpen] = useState(false);
  const rawSummary =
    part.text?.match(/\*\*(.+?)\*\*/)?.[1] ??
    (paced.trim().split(/[.\n]/)[0] ?? "").slice(0, 100);
  const summary = rawSummary.trim();

  return (
    <div className={cn(BUBBLE, "py-1.5 text-muted-foreground")}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 w-full text-xs text-left group cursor-pointer">
          <Brain className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground/80">Reasoning</span>
          <span className="text-muted-foreground truncate italic">
            {summary || "…"}
          </span>
          <ChevronDown
            className={cn(
              "w-3 h-3 shrink-0 ml-auto text-muted-foreground/50 transition-transform",
              !open && "-rotate-90",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap italic leading-relaxed">
            {paced}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ImagePartView({ part }: { part: FilePart }) {
  return (
    <div className={BUBBLE}>
      <img
        src={part.url}
        alt={part.filename ?? "attachment"}
        className="rounded-md max-w-full max-h-48"
      />
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className={BUBBLE}>
      <span className="inline-flex items-center gap-1 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
      </span>
    </div>
  );
}
