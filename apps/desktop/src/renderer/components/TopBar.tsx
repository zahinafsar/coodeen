import { useEffect, useState } from "react";
import { Menu, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrawer } from "../contexts/DrawerContext";
import { useProject } from "../contexts/ProjectContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import iconSvg from "../assets/icon.svg";
import { ApiKeyDialog } from "./chat/ApiKeyDialog";

interface CustomAction {
  label: string;
  script: string;
}

export function TopBar() {
  const { toggle } = useDrawer();
  const { projectDir } = useProject();
  const [actions, setActions] = useState<CustomAction[]>([]);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);

  // Load actions whenever projectDir changes
  useEffect(() => {
    if (!projectDir) {
      setActions([]);
      return;
    }

    const loadActions = async () => {
      try {
        const result = await api.getActions(projectDir);
        setActions(result.actions || []);
      } catch (error) {
        console.error("Failed to load actions:", error);
        setActions([]);
      }
    };

    loadActions();
  }, [projectDir]);

  const handleRunAction = async (script: string, label: string) => {
    if (!projectDir) {
      toast.error("Project directory not set");
      return;
    }

    console.log(`Running action "${label}" in directory: ${projectDir}`);
    setRunningAction(label);
    try {
      const result = await api.runAction(projectDir, script);
      console.log(`Action "${label}" result:`, result);
      if (result.ok) {
        toast.success(`${label} completed`);
      } else {
        toast.error(`${label} failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Action failed:", error);
      toast.error(`${label} failed`);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <header
      className="flex items-center justify-between h-12 pl-20 pr-3 bg-card border-b shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sessions</TooltipContent>
        </Tooltip>
        <img src={iconSvg} alt="Coodeen" className="h-7 w-auto" />
      </div>

      <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant="outline"
            onClick={() => handleRunAction(action.script, action.label)}
            disabled={runningAction === action.label}
            title={action.script}
            className="h-8 text-xs gap-1.5"
          >
            {runningAction === action.label ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            {action.label}
          </Button>
        ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setApiKeyOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Set OpenAI API key</TooltipContent>
        </Tooltip>
      </div>
      <ApiKeyDialog open={apiKeyOpen} onOpenChange={setApiKeyOpen} />
    </header>
  );
}
