import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { GitChangesTab } from "./GitChangesTab";
import { GitBranchesTab } from "./GitBranchesTab";

type GitSubTab = "changes" | "branches";

export function GitManagerPanel({ projectDir }: { projectDir: string }) {
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [subTab, setSubTab] = useState<GitSubTab>("changes");

  const loadGitStatus = useCallback(async () => {
    if (!projectDir) return;
    try {
      const status = await api.getGitStatus(projectDir);
      setIsGitRepo(status.isGitRepo);
    } catch (error) {
      console.error("Failed to load git status:", error);
    }
  }, [projectDir]);

  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  if (!isGitRepo) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Not a git repository</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex border-b shrink-0">
        <button
          type="button"
          onClick={() => setSubTab("changes")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors border-b-2",
            subTab === "changes"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Changes
        </button>
        <button
          type="button"
          onClick={() => setSubTab("branches")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors border-b-2",
            subTab === "branches"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Branches
        </button>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 min-h-0">
        {subTab === "changes" ? (
          <GitChangesTab projectDir={projectDir} />
        ) : (
          <GitBranchesTab projectDir={projectDir} />
        )}
      </div>
    </div>
  );
}
