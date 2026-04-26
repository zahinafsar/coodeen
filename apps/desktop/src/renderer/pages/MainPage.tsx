import { useState, useCallback, useEffect, useRef } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ChatPanel, type ChatPanelHandle } from "../components/chat/ChatPanel";
import { PreviewPanel } from "../components/preview/PreviewPanel";
import { FileExplorerPanel } from "../components/files/FileExplorerPanel";
import { GitManagerPanel } from "../components/git/GitManagerPanel";
import { TerminalPanel } from "../components/terminal/TerminalPanel";
import { DesignCanvas } from "../components/design/DesignCanvas";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  ElementSelectionProvider,
  useElementSelection,
} from "../contexts/ElementSelectionContext";
import { useProject } from "../contexts/ProjectContext";
import { useRightPanel } from "../contexts/RightPanelContext";
import { cn } from "@/lib/utils";
import type { FileReference } from "../lib/types";
import type { ElementInfo } from "../components/preview/SelectionOverlay";

const DEFAULT_PREVIEW_URL = "http://localhost:3000";

type RightTab = "preview" | "design" | "files" | "git";

const GENERATE_PROMPT = `Scan this project and detect every user-facing route (Next.js app/pages router, React Router, etc.). Then write a file named \`coodeen.json\` at the project root with exactly this JSON shape (no extra fields, no comments):

{
  "design": {
    "host": "http://localhost:3000",
    "pages": [{ "route": "/" }, { "route": "/some-route" }]
  }
}

Include only unique top-level routes the user can visit. Use \`/\` for the home route. Use the \`write\` tool to create the file. Do not run any other commands.`;

export function MainPage() {
  return (
    <ElementSelectionProvider>
      <MainPageInner />
    </ElementSelectionProvider>
  );
}

function MainPageInner() {
  const { projectDir } = useProject();
  const { open: rightOpen } = useRightPanel();
  const { addScreenshot } = useElementSelection();
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_PREVIEW_URL);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chatRef = useRef<ChatPanelHandle | null>(null);

  const handleGenerateCoodeen = useCallback(() => {
    if (!projectDir) {
      toast.error("Select a project folder first");
      return;
    }
    if (!chatRef.current) return;
    setGenerating(true);
    chatRef.current.sendMessage(GENERATE_PROMPT);
  }, [projectDir]);

  useEffect(() => {
    if (!generating || !projectDir) return;
    const off = api.onCoodeenChanged(({ dir }) => {
      if (dir === projectDir) setGenerating(false);
    });
    return () => off();
  }, [generating, projectDir]);

  const handlePreviewUrlChange = useCallback((url: string) => {
    setPreviewUrl(url);
  }, []);

  const handleFileReference = useCallback((ref: FileReference) => {
    setFileReferences((prev) => {
      const exists = prev.some(
        (r) =>
          r.filePath === ref.filePath &&
          r.startLine === ref.startLine &&
          r.endLine === ref.endLine,
      );
      if (exists) return prev;
      return [...prev, ref];
    });
  }, []);

  const handleRemoveFileReference = useCallback((index: number) => {
    setFileReferences((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFileReferences = useCallback(() => {
    setFileReferences([]);
  }, []);

  const handleElementSelected = useCallback(
    (info: ElementInfo) => {
      if (info.screenshot) {
        addScreenshot(info.screenshot);
      }
    },
    [addScreenshot],
  );

  if (!rightOpen) {
    return (
      <ChatPanel
        ref={chatRef}
        previewUrl={previewUrl}
        onPreviewUrlChange={handlePreviewUrlChange}
        fileReferences={fileReferences}
        onAddFileReference={handleFileReference}
        onRemoveFileReference={handleRemoveFileReference}
        onClearFileReferences={handleClearFileReferences}
      />
    );
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={50} minSize={25}>
        <ChatPanel
          ref={chatRef}
          previewUrl={previewUrl}
          onPreviewUrlChange={handlePreviewUrlChange}
          fileReferences={fileReferences}
          onAddFileReference={handleFileReference}
          onRemoveFileReference={handleRemoveFileReference}
          onClearFileReferences={handleClearFileReferences}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={15}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center border-b bg-card shrink-0">
            <button
              type="button"
              onClick={() => setRightTab("preview")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                rightTab === "preview"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setRightTab("design")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                rightTab === "design"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Design
            </button>
            <button
              type="button"
              onClick={() => setRightTab("files")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                rightTab === "files"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Files
            </button>
            <button
              type="button"
              onClick={() => setRightTab("git")}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                rightTab === "git"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Git
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ResizablePanelGroup orientation="vertical" className="h-full">
              <ResizablePanel defaultSize={terminalOpen ? 60 : 100} minSize={20}>
                {rightTab === "preview" ? (
                  <PreviewPanel
                    url={previewUrl}
                    onUrlChange={handlePreviewUrlChange}
                    terminalOpen={terminalOpen}
                    onToggleTerminal={() => setTerminalOpen((v) => !v)}
                    onElementSelected={handleElementSelected}
                  />
                ) : rightTab === "design" ? (
                  <DesignCanvas
                    projectDir={projectDir}
                    onGenerate={handleGenerateCoodeen}
                    generating={generating}
                  />
                ) : rightTab === "files" ? (
                  <FileExplorerPanel
                    projectDir={projectDir}
                    onFileReference={handleFileReference}
                  />
                ) : (
                  <GitManagerPanel projectDir={projectDir} />
                )}
              </ResizablePanel>
              {terminalOpen && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={40} minSize={10}>
                    <div className="flex flex-col h-full bg-[#0a0a0a]">
                      <div className="flex-1 min-h-0">
                        <TerminalPanel projectDir={projectDir} />
                      </div>
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
