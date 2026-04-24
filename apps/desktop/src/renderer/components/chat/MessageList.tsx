import { useEffect, useRef, useCallback, useMemo } from "react";
import { MessageBubble } from "./MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Message, Part } from "../../stores/chat-store";

interface MessageListProps {
  messages: Array<Message & { parts: Part[] }>;
  working: boolean;
}

/**
 * Opencode emits one assistant message per LLM step. Visually we want a
 * single "turn" per user request, so collapse consecutive assistant
 * messages into one combined bubble whose parts are concatenated in order.
 */
function mergeAssistantTurns(
  messages: Array<Message & { parts: Part[] }>,
): Array<Message & { parts: Part[] }> {
  const out: Array<Message & { parts: Part[] }> = [];
  for (const msg of messages) {
    const last = out[out.length - 1];
    if (last && last.role === "assistant" && msg.role === "assistant") {
      out[out.length - 1] = {
        ...last,
        time: {
          ...last.time,
          // Turn is complete only when the latest step completes.
          completed: msg.time.completed,
        },
        parts: [...last.parts, ...msg.parts],
      };
    } else {
      out.push(msg);
    }
  }
  return out;
}

export function MessageList({ messages, working }: MessageListProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const workingRef = useRef(false);
  workingRef.current = working;

  const merged = useMemo(() => mergeAssistantTurns(messages), [messages]);

  const getViewport = useCallback(
    () =>
      wrapperRef.current?.querySelector<HTMLDivElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? null,
    [],
  );

  const isNearBottom = useCallback(() => {
    const el = getViewport();
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, [getViewport]);

  useEffect(() => {
    if (!isNearBottom()) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = getViewport();
      if (!el) return;
      if (workingRef.current) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [messages, isNearBottom, getViewport]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <span className="text-2xl opacity-50">&#128187;</span>
        <span>Start coding — describe what you want to build</span>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex-1 min-h-0">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-3 p-4">
          {merged.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
