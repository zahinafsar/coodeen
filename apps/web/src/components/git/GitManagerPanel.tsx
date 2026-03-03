import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  fullRef: string;
}

export function GitManagerPanel({ projectDir }: { projectDir: string }) {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGitRepo, setIsGitRepo] = useState(false);

  const loadGitStatus = useCallback(async () => {
    if (!projectDir) return;
    try {
      const status = await api.getGitStatus(projectDir);
      setIsGitRepo(status.isGitRepo);
    } catch (error) {
      console.error("Failed to load git status:", error);
    }
  }, [projectDir]);

  const loadBranches = useCallback(async () => {
    if (!projectDir || !isGitRepo) return;
    setLoading(true);
    try {
      const result = await api.getGitBranches(projectDir);
      setBranches(result.branches);
    } catch (error) {
      console.error("Failed to load branches:", error);
      toast.error("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }, [projectDir, isGitRepo]);

  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  useEffect(() => {
    if (isGitRepo) {
      loadBranches();
    }
  }, [isGitRepo, loadBranches]);

  const handleCheckout = async (branchName: string) => {
    try {
      await api.gitCheckout(projectDir, branchName);
      toast.success(`Switched to ${branchName}`);
      await loadBranches();
    } catch (error) {
      console.error("Checkout failed:", error);
      toast.error("Failed to checkout branch");
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (confirm(`Delete branch "${branchName}"?`)) {
      try {
        await api.gitDeleteBranch(projectDir, branchName, false);
        toast.success(`Deleted branch: ${branchName}`);
        await loadBranches();
      } catch (error) {
        console.error("Delete branch failed:", error);
        toast.error("Failed to delete branch");
      }
    }
  };

  if (!isGitRepo) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Not a git repository</p>
      </div>
    );
  }

  const localBranches = branches.filter((b) => !b.isRemote);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {localBranches.length > 0 ? (
          localBranches.map((branch) => (
            <div
              key={branch.fullRef}
              className="flex items-center justify-between gap-2 p-2 rounded border"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate">{branch.name}</span>
                {branch.isCurrent && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    current
                  </Badge>
                )}
              </div>
              {!branch.isCurrent && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCheckout(branch.name)}
                    disabled={loading}
                    className="h-8 text-xs"
                  >
                    Switch
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteBranch(branch.name)}
                    disabled={loading}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No branches</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
