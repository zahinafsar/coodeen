import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Plus, Minus, Undo2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GitChange {
  file: string;
  index: string;
  workTree: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  M: "bg-amber-500/20 text-amber-400",
  A: "bg-green-500/20 text-green-400",
  D: "bg-red-500/20 text-red-400",
  "?": "bg-neutral-500/20 text-neutral-400",
  R: "bg-blue-500/20 text-blue-400",
  U: "bg-purple-500/20 text-purple-400",
  C: "bg-cyan-500/20 text-cyan-400",
};

function StatusBadge({ code }: { code: string }) {
  return (
    <span
      className={cn(
        "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0",
        STATUS_COLORS[code] || STATUS_COLORS["?"]
      )}
    >
      {code}
    </span>
  );
}

export function GitChangesTab({ projectDir }: { projectDir: string }) {
  const [changes, setChanges] = useState<GitChange[]>([]);
  const [branch, setBranch] = useState("");
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [commitMessage, setCommitMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!projectDir) return;
    try {
      const status = await api.getGitStatus(projectDir);
      if (status.isGitRepo) {
        setChanges((status.changes as GitChange[]) || []);
        setBranch(status.branch || "");
        setAhead(status.ahead || 0);
        setBehind(status.behind || 0);
      }
    } catch (error) {
      console.error("Failed to load git status:", error);
    }
  }, [projectDir]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Staged = files with index status (not ? which means untracked)
  const stagedFiles = changes.filter((c) => c.index && c.index !== "?");
  // Unstaged = files with workTree status OR untracked (?)
  const unstagedFiles = changes.filter((c) => c.workTree || c.index === "?");

  const handleStage = async (files: string[]) => {
    setActionLoading("stage");
    try {
      await api.gitStage(projectDir, files);
      await loadStatus();
    } catch {
      toast.error("Failed to stage files");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnstage = async (files: string[]) => {
    setActionLoading("unstage");
    try {
      await api.gitUnstage(projectDir, files);
      await loadStatus();
    } catch {
      toast.error("Failed to unstage files");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscard = async (files: string[]) => {
    if (!confirm(`Discard changes to ${files.length} file${files.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setActionLoading("discard");
    try {
      await api.gitDiscard(projectDir, files);
      await loadStatus();
      toast.success("Changes discarded");
    } catch {
      toast.error("Failed to discard changes");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error("Commit message required");
      return;
    }
    setActionLoading("commit");
    try {
      await api.gitCommit(projectDir, commitMessage.trim());
      toast.success("Changes committed");
      setCommitMessage("");
      await loadStatus();
    } catch {
      toast.error("Commit failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePush = async () => {
    setActionLoading("push");
    try {
      await api.gitPush(projectDir);
      toast.success("Pushed to remote");
      await loadStatus();
    } catch {
      toast.error("Push failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePull = async () => {
    setActionLoading("pull");
    try {
      await api.gitPull(projectDir);
      toast.success("Pulled from remote");
      await loadStatus();
    } catch {
      toast.error("Pull failed");
    } finally {
      setActionLoading(null);
    }
  };

  const disabled = !!actionLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Sync bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
          {branch}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={loadStatus}
          disabled={disabled}
        >
          <RefreshCw className={cn("h-3 w-3", actionLoading && "animate-spin")} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handlePull}
          disabled={disabled}
        >
          <ArrowDown className="h-3 w-3" />
          Pull
          {behind > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
              {behind}
            </Badge>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handlePush}
          disabled={disabled}
        >
          <ArrowUp className="h-3 w-3" />
          Push
          {ahead > 0 ? (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">
              {ahead}
            </Badge>
          ) : null}
        </Button>
      </div>

      {/* File lists */}
      <ScrollArea className="flex-1">
        {/* Staged section */}
        {stagedFiles.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Staged ({stagedFiles.length})
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] px-2"
                onClick={() => handleUnstage(stagedFiles.map((f) => f.file))}
                disabled={disabled}
              >
                Unstage All
              </Button>
            </div>
            <div className="space-y-0.5">
              {stagedFiles.map((change) => (
                <div
                  key={`staged-${change.file}`}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 group"
                >
                  <StatusBadge code={change.index} />
                  <span className="text-xs truncate flex-1" title={change.file}>
                    {change.file}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleUnstage([change.file])}
                    disabled={disabled}
                    title="Unstage"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unstaged section */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Changes ({unstagedFiles.length})
            </span>
            {unstagedFiles.length > 0 && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2"
                  onClick={() => handleDiscard(unstagedFiles.map((f) => f.file))}
                  disabled={disabled}
                  title="Discard All"
                >
                  <Undo2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] px-2"
                  onClick={() => handleStage(unstagedFiles.map((f) => f.file))}
                  disabled={disabled}
                >
                  Stage All
                </Button>
              </div>
            )}
          </div>
          {unstagedFiles.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No changes
            </p>
          ) : (
            <div className="space-y-0.5">
              {unstagedFiles.map((change) => (
                <div
                  key={`unstaged-${change.file}`}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 group"
                >
                  <StatusBadge code={change.workTree || change.index} />
                  <span className="text-xs truncate flex-1" title={change.file}>
                    {change.file}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDiscard([change.file])}
                    disabled={disabled}
                    title="Discard"
                  >
                    <Undo2 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleStage([change.file])}
                    disabled={disabled}
                    title="Stage"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Commit area */}
      <div className="px-3 py-2 border-t shrink-0 space-y-2">
        <textarea
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          className="w-full min-h-[60px] max-h-[120px] text-sm resize-none rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleCommit();
            }
          }}
        />
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleCommit}
          disabled={
            !commitMessage.trim() || stagedFiles.length === 0 || disabled
          }
        >
          {actionLoading === "commit"
            ? "Committing..."
            : `Commit (${stagedFiles.length} file${stagedFiles.length !== 1 ? "s" : ""})`}
        </Button>
      </div>
    </div>
  );
}
