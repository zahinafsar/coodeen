import { useSyncExternalStore } from "react";

// ── Opencode event + message types (structurally subset) ─────────────────────

export interface Message {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  modelID?: string;
  providerID?: string;
  error?: unknown;
}

export interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
}

export interface ReasoningPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "reasoning";
  text: string;
}

export interface FilePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "file";
  mime: string;
  url: string;
  filename?: string;
}

export interface ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  tool: string;
  callID: string;
  state:
    | { status: "pending"; input: Record<string, unknown> }
    | {
        status: "running";
        input: Record<string, unknown>;
        title?: string;
        time: { start: number };
      }
    | {
        status: "completed";
        input: Record<string, unknown>;
        output: string;
        title?: string;
        time: { start: number; end: number };
      }
    | {
        status: "error";
        input: Record<string, unknown>;
        error: string;
        time?: { start: number; end: number };
      };
}

export type Part = TextPart | ReasoningPart | FilePart | ToolPart | {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  [k: string]: unknown;
};

export type SessionStatus =
  | { type: "idle" }
  | { type: string; [k: string]: unknown };

// ── Store shape ──────────────────────────────────────────────────────────────

interface SessionEntry {
  messageOrder: string[];
  messages: Record<string, Message>;
  partsByMessage: Record<string, Part[]>; // parts ordered by id (server order preserved)
  status: SessionStatus;
  error?: string;
}

interface State {
  sessions: Record<string, SessionEntry>;
}

const SKIP_PARTS = new Set(["patch", "step-start", "step-finish"]);

function emptySession(): SessionEntry {
  return {
    messageOrder: [],
    messages: {},
    partsByMessage: {},
    status: { type: "idle" },
  };
}

// ── Store singleton ──────────────────────────────────────────────────────────

let state: State = { sessions: {} };
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify() {
  for (const l of listeners) l();
}

function getSession(sid: string): SessionEntry {
  return state.sessions[sid] ?? emptySession();
}

function mutateSession(sid: string, fn: (s: SessionEntry) => SessionEntry) {
  const curr = state.sessions[sid] ?? emptySession();
  const next = fn(curr);
  state = {
    ...state,
    sessions: { ...state.sessions, [sid]: next },
  };
}

function upsertMessage(sid: string, msg: Message) {
  mutateSession(sid, (s) => {
    const exists = !!s.messages[msg.id];
    return {
      ...s,
      messageOrder: exists
        ? s.messageOrder
        : insertSorted(s.messageOrder, msg.id, (id) => {
            const m = s.messages[id];
            return m?.time.created ?? 0;
          }, msg.time.created),
      messages: { ...s.messages, [msg.id]: { ...s.messages[msg.id], ...msg } },
    };
  });
}

function insertSorted<T>(
  arr: T[],
  item: T,
  getKey: (v: T) => number,
  itemKey: number,
): T[] {
  const copy = arr.slice();
  let i = copy.length;
  while (i > 0 && getKey(copy[i - 1]) > itemKey) i--;
  copy.splice(i, 0, item);
  return copy;
}

function upsertPart(msgId: string, sid: string, part: Part) {
  if (SKIP_PARTS.has(part.type)) return;
  mutateSession(sid, (s) => {
    const list = s.partsByMessage[msgId] ?? [];
    const idx = list.findIndex((p) => p.id === part.id);
    let next: Part[];
    if (idx === -1) {
      next = [...list, part];
    } else {
      next = list.slice();
      next[idx] = part;
    }

    // If we don't have a message.updated for this messageID yet, synthesize
    // a minimal assistant message so the UI can render parts as they arrive.
    let messages = s.messages;
    let messageOrder = s.messageOrder;
    if (!messages[msgId]) {
      const synth: Message = {
        id: msgId,
        sessionID: sid,
        role: "assistant",
        time: { created: Date.now() },
      };
      messages = { ...messages, [msgId]: synth };
      messageOrder = [...messageOrder, msgId];
    }

    return {
      ...s,
      messages,
      messageOrder,
      partsByMessage: { ...s.partsByMessage, [msgId]: next },
    };
  });
}

function appendDelta(msgId: string, sid: string, partId: string, delta: string) {
  mutateSession(sid, (s) => {
    const list = s.partsByMessage[msgId];
    if (!list) return s;
    const idx = list.findIndex((p) => p.id === partId);
    if (idx === -1) return s;
    const existing = list[idx] as TextPart | ReasoningPart | Part;
    if (existing.type !== "text" && existing.type !== "reasoning") return s;
    const nextPart = {
      ...existing,
      text: (existing as TextPart).text + delta,
    } as Part;
    const nextList = list.slice();
    nextList[idx] = nextPart;
    return {
      ...s,
      partsByMessage: { ...s.partsByMessage, [msgId]: nextList },
    };
  });
}

function removePart(msgId: string, sid: string, partId: string) {
  mutateSession(sid, (s) => {
    const list = s.partsByMessage[msgId];
    if (!list) return s;
    const next = list.filter((p) => p.id !== partId);
    return {
      ...s,
      partsByMessage: { ...s.partsByMessage, [msgId]: next },
    };
  });
}

function removeMessage(sid: string, msgId: string) {
  mutateSession(sid, (s) => {
    const { [msgId]: _dropMsg, ...restMsgs } = s.messages;
    const { [msgId]: _dropParts, ...restParts } = s.partsByMessage;
    void _dropMsg;
    void _dropParts;
    return {
      ...s,
      messageOrder: s.messageOrder.filter((id) => id !== msgId),
      messages: restMsgs,
      partsByMessage: restParts,
    };
  });
}

// ── Event reducer ────────────────────────────────────────────────────────────

export function applyOpencodeEvent(evt: {
  type: string;
  properties?: unknown;
}) {
  const props = (evt.properties ?? {}) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyProps = props as any;
  const sid =
    anyProps?.sessionID ??
    anyProps?.info?.sessionID ??
    anyProps?.part?.sessionID;
  // eslint-disable-next-line no-console
  console.log("[opencode event]", evt.type, "sid:", sid);
  switch (evt.type) {
    case "message.updated": {
      const info = props.info as Message | undefined;
      if (!info) return;
      upsertMessage(info.sessionID, info);
      notify();
      return;
    }
    case "message.removed": {
      const p = props as { sessionID: string; messageID: string };
      if (!p.sessionID || !p.messageID) return;
      removeMessage(p.sessionID, p.messageID);
      notify();
      return;
    }
    case "message.part.updated": {
      const part = props.part as Part | undefined;
      if (!part) return;
      // v1 SDK: delta is an optional property on this event
      const delta = typeof props.delta === "string" ? (props.delta as string) : "";
      upsertPart(part.messageID, part.sessionID, part);
      if (delta) appendDelta(part.messageID, part.sessionID, part.id, delta);
      notify();
      return;
    }
    case "message.part.removed": {
      const p = props as {
        sessionID: string;
        messageID: string;
        partID: string;
      };
      if (!p.messageID || !p.partID) return;
      removePart(p.messageID, p.sessionID, p.partID);
      notify();
      return;
    }
    case "session.status": {
      const p = props as { sessionID: string; status: SessionStatus };
      if (!p.sessionID) return;
      mutateSession(p.sessionID, (s) => ({ ...s, status: p.status }));
      notify();
      return;
    }
    case "session.idle": {
      const p = props as { sessionID: string };
      if (!p.sessionID) return;
      mutateSession(p.sessionID, (s) => ({ ...s, status: { type: "idle" } }));
      notify();
      return;
    }
    case "session.error": {
      const p = props as {
        sessionID?: string;
        error?: { data?: { message?: string }; message?: string };
      };
      const message = p.error?.data?.message ?? p.error?.message ?? "Session error";
      if (p.sessionID) {
        mutateSession(p.sessionID, (s) => ({ ...s, error: message }));
      }
      notify();
      return;
    }
    default:
      // ignore other events (session.created/updated/deleted handled elsewhere)
      return;
  }
}

// ── Bulk hydration (from session.messages API) ───────────────────────────────

export function hydrateSession(
  sid: string,
  items: Array<{ info: Message; parts: Part[] }>,
) {
  mutateSession(sid, () => {
    const s = emptySession();
    const sorted = [...items].sort(
      (a, b) => (a.info.time.created ?? 0) - (b.info.time.created ?? 0),
    );
    for (const it of sorted) {
      s.messages[it.info.id] = it.info;
      s.messageOrder.push(it.info.id);
      s.partsByMessage[it.info.id] = it.parts.filter(
        (p) => !SKIP_PARTS.has(p.type),
      );
    }
    return s;
  });
  notify();
}

export function clearSession(sid: string) {
  if (!state.sessions[sid]) return;
  state = {
    ...state,
    sessions: Object.fromEntries(
      Object.entries(state.sessions).filter(([k]) => k !== sid),
    ),
  };
  notify();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface ChatSessionView {
  messages: Array<Message & { parts: Part[] }>;
  status: SessionStatus;
  working: boolean;
  error?: string;
}

export function useChatSession(sid: string | null): ChatSessionView {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (sid ? state.sessions[sid] : undefined),
    () => (sid ? state.sessions[sid] : undefined),
  );

  if (!sid || !snapshot) {
    return {
      messages: [],
      status: { type: "idle" },
      working: false,
    };
  }

  const messages = snapshot.messageOrder.map((id) => {
    const info = snapshot.messages[id]!;
    return { ...info, parts: snapshot.partsByMessage[id] ?? [] };
  });

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const working =
    (!!lastAssistant && typeof lastAssistant.time.completed !== "number") ||
    (snapshot.status.type !== "idle" && snapshot.status.type !== undefined);

  return {
    messages,
    status: snapshot.status,
    working,
    error: snapshot.error,
  };
}

// ── Wire global event bus (call once at app boot) ────────────────────────────

let wired = false;
export function wireChatStore(): void {
  if (wired) return;
  wired = true;
  window.electronAPI.opencode.onEvent((evt) => {
    applyOpencodeEvent(evt);
  });
}
