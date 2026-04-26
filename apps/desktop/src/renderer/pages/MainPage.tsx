import { useState, useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ChatPanel } from "../components/chat/ChatPanel";
import { PreviewPanel } from "../components/preview/PreviewPanel";
import { FileExplorerPanel } from "../components/files/FileExplorerPanel";
import { GitManagerPanel } from "../components/git/GitManagerPanel";
import { TerminalPanel } from "../components/terminal/TerminalPanel";
import {
  ElementSelectionProvider,
  useElementSelection,
} from "../contexts/ElementSelectionContext";
import { useProject } from "../contexts/ProjectContext";
import { cn } from "@/lib/utils";
import type { FileReference } from "../lib/types";
import type { ElementInfo } from "../components/preview/SelectionOverlay";

const DEFAULT_PREVIEW_URL = "http://localhost:3000";

type RightTab = "preview" | "files" | "git";

export function MainPage() {
  return (
    <ElementSelectionProvider>
      <MainPageInner />
    </ElementSelectionProvider>
  );
}

function MainPageInner() {
  const { projectDir } = useProject();
  const { addScreenshot } = useElementSelection();
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_PREVIEW_URL);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);
  const [terminalOpen, setTerminalOpen] = useState(false);

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

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={50} minSize={25}>
        <ChatPanel
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
