import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import type { Session } from "../../lib/types";
import { api } from "../../lib/api";
import { useDrawer } from "../../contexts/DrawerContext";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SessionDrawerProps {
  currentSessionId: string | null;
  onSelectSession: (session: Session) => void;
  onNewSession: () => void;
  onDeleteSession?: (sessionId: string) => void;
  refreshKey?: number;
}

export function SessionDrawer({
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  refreshKey,
}: SessionDrawerProps) {
  const { open, close } = useDrawer();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const list = await api.getSessions();
      setSessions(list);
    } catch {
      // silent
    }
  }, []);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      if (!window.confirm("Delete this session?")) return;
      try {
        await api.deleteSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (sessionId === currentSessionId) {
          onDeleteSession?.(sessionId);
        }
      } catch {
        // silent
      }
    },
    [currentSessionId, onDeleteSession],
  );

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshKey]);

  useEffect(() => {
    if (open) fetchSessions();
  }, [open, fetchSessions]);

  const handleSelect = useCallback(
    (session: Session) => {
      onSelectSession(session);
      close();
    },
    [onSelectSession, close],
  );

  const handleNew = useCallback(() => {
    onNewSession();
    close();
  }, [onNewSession, close]);

  const handleStartEdit = useCallback(
    (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
      e.stopPropagation();
      setEditingId(sessionId);
      setEditingTitle(currentTitle);
    },
    [],
  );

  const handleSaveTitle = useCallback(
    async (sessionId: string) => {
      const trimmed = editingTitle.trim();
      if (trimmed && trimmed !== sessions.find((s) => s.id === sessionId)?.title) {
        try {
          await api.updateSession(sessionId, { title: trimmed });
          setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s)),
          );
        } catch {
          // silent
        }
      }
      setEditingId(null);
      setEditingTitle("");
    },
    [editingTitle, sessions],
  );

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent side="left" showCloseButton={false} className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 pt-12 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-semibold uppercase tracking-wider">
              Sessions
            </SheetTitle>
            <Button variant="outline" size="sm" onClick={handleNew} className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {sessions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No sessions yet.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "group flex items-center rounded-md transition-colors",
                      s.id === currentSessionId
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    {editingId === s.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleSaveTitle(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveTitle(s.id);
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className="flex-1 text-left px-3 py-2.5 text-sm truncate min-w-0"
                        onClick={() => handleSelect(s)}
                        type="button"
                      >
                        {s.title}
                      </button>
                    )}
                    <button
                      className="shrink-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleStartEdit(e, s.id, s.title)}
                      type="button"
                      aria-label="Edit session title"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="shrink-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => handleDelete(e, s.id)}
                      type="button"
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
