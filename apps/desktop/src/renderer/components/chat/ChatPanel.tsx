import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { FileReference, Session } from "../../lib/types";
import { api, type SessionModel } from "../../lib/api";
import { useProject } from "../../contexts/ProjectContext";
import { MessageList } from "./MessageList";
import { PromptInput } from "./PromptInput";
import { SessionDrawer } from "./SessionDrawer";
import { ModelPicker } from "./ModelPicker";
import logoSvg from "../../assets/logo.svg";
import {
  useChatSession,
  hydrateSession,
  clearSession,
  type Message,
  type Part,
} from "../../stores/chat-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function generateSessionTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const MAX_TITLE = 60;
  if (trimmed.length <= MAX_TITLE) return trimmed;
  return trimmed.substring(0, MAX_TITLE).replace(/\s+$/, "") + "...";
}

interface ChatPanelProps {
  previewUrl: string;
  onPreviewUrlChange: (url: string) => void;
  fileReferences?: FileReference[];
  onAddFileReference?: (ref: FileReference) => void;
  onRemoveFileReference?: (index: number) => void;
  onClearFileReferences?: () => void;
}

export interface ChatPanelHandle {
  sendMessage: (prompt: string) => void;
  hasSession: () => boolean;
}

export const ChatPanel = forwardRef<ChatPanelHandle, ChatPanelProps>(function ChatPanel({
  previewUrl,
  onPreviewUrlChange,
  fileReferences = [],
  onAddFileReference,
  onRemoveFileReference,
  onClearFileReferences,
}, forwardedRef) {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { projectDir, setProjectDir } = useProject();

  const [sessionId, setSessionId] = useState<string | null>(urlSessionId ?? null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [model, setModel] = useState<SessionModel | null>(null);
  const [needsModelAlert, setNeedsModelAlert] = useState(false);

  const { messages, working, error } = useChatSession(sessionId);
  const initialLoadDone = useRef(false);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      toast.error(error);
    }
    if (!error) lastErrorRef.current = null;
  }, [error]);

  // Hydrate per-session model when session id changes.
  useEffect(() => {
    if (!sessionId) {
      setModel(null);
      return;
    }
    let cancelled = false;
    api
      .getSessionModel(sessionId)
      .then((m) => {
        if (!cancelled) setModel(m);
      })
      .catch(() => {
        if (!cancelled) setModel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const handleModelChange = useCallback(
    (next: SessionModel) => {
      setModel(next);
      if (sessionId) {
        api.setSessionModel(sessionId, next).catch(() => {});
      }
    },
    [sessionId],
  );

  // Load session from URL on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    if (!urlSessionId) return;
    initialLoadDone.current = true;

    (async () => {
      try {
        const sessions = await api.getSessions();
        const session = sessions.find((s) => s.id === urlSessionId);
        if (!session) {
          navigate("/", { replace: true });
          return;
        }
        setSessionId(session.id);
        if (session.projectDir) setProjectDir(session.projectDir);
        if (session.previewUrl) onPreviewUrlChange(session.previewUrl);

        const msgs = await api.getMessages(session.id);
        hydrateSession(
          session.id,
          msgs as unknown as Array<{ info: Message; parts: Part[] }>,
        );
      } catch {
        navigate("/", { replace: true });
      }
    })();
  }, [urlSessionId, navigate, onPreviewUrlChange, setProjectDir]);

  const loadSession = useCallback(
    async (session: Session) => {
      setSessionId(session.id);
      navigate(`/session/${session.id}`);
      if (session.projectDir) setProjectDir(session.projectDir);
      if (session.previewUrl) onPreviewUrlChange(session.previewUrl);

      try {
        const msgs = await api.getMessages(session.id);
        hydrateSession(
          session.id,
          msgs as unknown as Array<{ info: Message; parts: Part[] }>,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load messages");
      }
    },
    [navigate, onPreviewUrlChange, setProjectDir],
  );

  const createSession = useCallback(() => {
    setSessionId(null);
    setProjectDir("");
    navigate("/");
  }, [navigate, setProjectDir]);

  const deleteSession = useCallback(() => {
    if (sessionId) clearSession(sessionId);
    setSessionId(null);
    navigate("/");
  }, [navigate, sessionId]);

  const prevPreviewUrl = useRef(previewUrl);
  useEffect(() => {
    if (previewUrl !== prevPreviewUrl.current) {
      prevPreviewUrl.current = previewUrl;
      if (sessionId) {
        api.updateSession(sessionId, { previewUrl }).catch(() => {});
      }
    }
  }, [previewUrl, sessionId]);

  const sendMessage = useCallback(
    async (prompt: string, screenshots?: string[]) => {
      let sid = sessionId;
      if (!sid && !projectDir) {
        toast.error("Select a project folder first");
        return;
      }

      if (!model) {
        setNeedsModelAlert(true);
        return;
      }

      const isFirstMessage = !sid;
      if (!sid) {
        try {
          const session = await api.createSession({
            providerId: model.providerId,
            modelId: model.modelId,
            projectDir: projectDir || undefined,
            previewUrl,
          });
          sid = session.id;
          setSessionId(sid);
          hydrateSession(sid, []);
          setRefreshKey((k) => k + 1);
          window.history.replaceState(null, "", `#/session/${sid}`);
          api.setSessionModel(sid, model).catch(() => {});
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to create session");
          return;
        }
      }

      try {
        const res = await window.electronAPI.chat.prompt({
          sessionId: sid!,
          prompt,
          providerId: model.providerId,
          modelId: model.modelId,
          projectDir: projectDir || undefined,
          images: screenshots,
        });
        if (!res.ok && res.error) {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        if (isFirstMessage && sid) {
          const title = generateSessionTitle(prompt);
          api.updateSession(sid, { title }).catch(() => {});
        }
      }
    },
    [sessionId, projectDir, previewUrl, model],
  );

  const handleStop = useCallback(() => {
    if (sessionId) {
      window.electronAPI.chat.stop(sessionId).catch(() => {});
    }
  }, [sessionId]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      sendMessage: (prompt: string) => {
        sendMessage(prompt);
      },
      hasSession: () => !!sessionId,
    }),
    [sendMessage, sessionId],
  );

  const isEmpty = messages.length === 0;

  return (
    <>
      <SessionDrawer
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewSession={createSession}
        onDeleteSession={deleteSession}
        refreshKey={refreshKey}
      />
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-10 px-6 pb-20 max-w-[680px] mx-auto w-full">
            <img
              src={logoSvg}
              alt="Coodeen"
              className="w-[clamp(200px,50%,420px)] h-auto opacity-80"
            />
            <PromptInput
              onSubmit={sendMessage}
              disabled={working}
              streaming={working}
              onStop={handleStop}
              variant="landing"
              fileReferences={fileReferences}
              onAddFileReference={onAddFileReference}
              onRemoveFileReference={onRemoveFileReference}
              onClearFileReferences={onClearFileReferences}
              toolbarSlot={
                <ModelPicker value={model} onChange={handleModelChange} />
              }
            />
          </div>
        ) : (
          <>
            <MessageList messages={messages} working={working} />
            <PromptInput
              onSubmit={sendMessage}
              disabled={working}
              streaming={working}
              onStop={handleStop}
              fileReferences={fileReferences}
              onAddFileReference={onAddFileReference}
              onRemoveFileReference={onRemoveFileReference}
              onClearFileReferences={onClearFileReferences}
              toolbarSlot={
                <ModelPicker value={model} onChange={handleModelChange} />
              }
            />
          </>
        )}
      </div>
      <Dialog open={needsModelAlert} onOpenChange={setNeedsModelAlert}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pick a model</DialogTitle>
            <DialogDescription>
              Choose a provider and model before sending. Add API keys in Settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNeedsModelAlert(false)}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setNeedsModelAlert(false);
                navigate("/settings");
              }}
            >
              Open Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
