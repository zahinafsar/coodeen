import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type FormEvent, type ClipboardEvent, type ChangeEvent, type DragEvent } from "react";
import { Send, Square, X, Folder, ImagePlus, FileCode } from "lucide-react";
import { useElementSelection } from "../../contexts/ElementSelectionContext";
import { useProject } from "../../contexts/ProjectContext";
import type { FileReference } from "../../lib/types";
import { FolderPickerDialog } from "./FolderPickerDialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Match any http(s) URL in text */
const URL_RE = /https?:\/\/\S+/gi;

/** Try to fetch a URL as an image and return a base64 data URL, or null on failure */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface PromptInputProps {
  onSubmit: (prompt: string, screenshots?: string[]) => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  variant?: "default" | "landing";
  fileReferences?: FileReference[];
  onAddFileReference?: (ref: FileReference) => void;
  onRemoveFileReference?: (index: number) => void;
  onClearFileReferences?: () => void;
}

export function PromptInput({
  onSubmit,
  disabled,
  streaming,
  onStop,
  variant = "default",
  fileReferences = [],
  onAddFileReference,
  onRemoveFileReference,
  onClearFileReferences,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { projectDir, setProjectDir } = useProject();
  const {
    selections,
    removeSelection,
    clearSelections,
    screenshots,
    addScreenshot,
    removeScreenshot,
    clearScreenshots,
    pendingPrefix,
    setPendingPrefix,
  } = useElementSelection();

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const value = textareaRef.current?.value.trim();
      if (!value || disabled) return;

      // Clear input immediately so it feels responsive
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }

      let finalPrompt = value;

      // Prepend file references (path + lines only — agent reads the file)
      if (fileReferences.length > 0) {
        const refLines = fileReferences
          .map((r) =>
            r.startLine === 0 && r.endLine === 0
              ? `[File: ${r.filePath}]`
              : `[File: ${r.filePath}:${r.startLine}-${r.endLine}]`,
          )
          .join("\n");
        finalPrompt = refLines + "\n\n" + finalPrompt;
        onClearFileReferences?.();
      }

      if (selections.length > 0) {
        const selectionLines = selections
          .map((s) => `[Element: ${s.component} in ${s.file}:${s.line}]`)
          .join("\n");
        finalPrompt = selectionLines + "\n" + finalPrompt;
        clearSelections();
      }

      // Collect images from screenshots (pasted / file-picked)
      const allImages = screenshots.map((s) => s.dataUrl);

      // Find URLs in prompt text, try to fetch each as an image
      const urlMatches = value.match(URL_RE);
      if (urlMatches) {
        const unique = [...new Set(urlMatches)];
        const results = await Promise.all(unique.map(fetchImageAsDataUrl));
        const fetchedUrls: string[] = [];
        for (let i = 0; i < unique.length; i++) {
          if (results[i] != null) {
            allImages.push(results[i] as string);
            fetchedUrls.push(unique[i]);
          }
        }
        // Strip successfully fetched image URLs from the prompt text
        if (fetchedUrls.length > 0) {
          for (const url of fetchedUrls) {
            finalPrompt = finalPrompt.replaceAll(url, "");
          }
          finalPrompt = finalPrompt.replace(/\s{2,}/g, " ").trim();
        }
      }

      onSubmit(finalPrompt, allImages.length > 0 ? allImages : undefined);
      clearScreenshots();
    },
    [onSubmit, disabled, selections, clearSelections, screenshots, clearScreenshots, fileReferences, onClearFileReferences],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    if (!pendingPrefix) return;
    const el = textareaRef.current;
    if (!el) return;
    el.value = pendingPrefix + el.value;
    handleInput();
    el.focus();
    setPendingPrefix("");
  }, [pendingPrefix, setPendingPrefix, handleInput]);

  // Paste image from clipboard
  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              addScreenshot(reader.result);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [addScreenshot],
  );

  // Select image from file system
  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            addScreenshot(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [addScreenshot],
  );

  // Drag-drop: images from anywhere + files from tree
  const handleDragOver = useCallback((e: DragEvent) => {
    if (
      e.dataTransfer.types.includes("application/x-file-path") ||
      e.dataTransfer.types.includes("Files")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      // Handle native file drops (images from Finder/Explorer/desktop/any folder)
      if (e.dataTransfer.files.length > 0) {
        for (const file of e.dataTransfer.files) {
          if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                addScreenshot(reader.result);
              }
            };
            reader.readAsDataURL(file);
          }
        }
        return;
      }

      // Handle internal file tree drops
      const droppedPath = e.dataTransfer.getData("application/x-file-path");
      if (droppedPath && onAddFileReference) {
        onAddFileReference({
          filePath: droppedPath,
          startLine: 0,
          endLine: 0,
          content: "",
        });
      }
    },
    [onAddFileReference, addScreenshot],
  );

  const isLanding = variant === "landing";

  return (
    <form
      className={cn(
        "relative flex flex-col gap-2 shrink-0",
        isLanding ? "w-full" : "p-3 border-t bg-card",
      )}
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-white/60 dark:bg-black/60">
          <span className="text-sm font-medium text-muted-foreground">Drop images here</span>
        </div>
      )}
      {/* File reference badges */}
      {fileReferences.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fileReferences.map((ref, i) => {
            const shortPath = ref.filePath.split("/").pop() ?? ref.filePath;
            return (
              <Badge
                key={`${ref.filePath}-${ref.startLine}-${ref.endLine}`}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <FileCode className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {shortPath}
                  {ref.startLine > 0 && (
                    <span className="text-blue-400 ml-1">
                      L{ref.startLine}{ref.startLine !== ref.endLine ? `-L${ref.endLine}` : ""}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                  onClick={() => onRemoveFileReference?.(i)}
                  aria-label="Remove file reference"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Element selection badges */}
      {selections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selections.map((sel, i) => (
            <Badge
              key={`${sel.component}-${sel.file}-${sel.line}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="truncate">
                {sel.component}{" "}
                <span className="text-blue-400">
                  ({sel.file}:{sel.line})
                </span>
              </span>
              <button
                type="button"
                className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                onClick={() => removeSelection(i)}
                aria-label={`Remove ${sel.component} selection`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Screenshot thumbnails */}
      {screenshots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {screenshots.map((ss) => (
            <div
              key={ss.id}
              className="relative group w-20 h-20 rounded-md overflow-hidden border border-border bg-muted"
            >
              <img
                src={ss.dataUrl}
                alt="Screenshot"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeScreenshot(ss.id)}
                aria-label="Remove screenshot"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Textarea
          ref={textareaRef}
          className={cn(
            "flex-1 resize-none min-h-[40px] max-h-[200px]",
            isLanding && "bg-card border-border text-[15px] py-3.5 px-4 min-h-[48px]"
          )}
          placeholder="Describe what you want to build..."
          rows={1}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
        />
        {streaming ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className={cn("shrink-0", isLanding ? "h-12 w-12" : "h-10 w-10")}
            onClick={onStop}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className={cn("shrink-0", isLanding ? "h-12 w-12" : "h-10 w-10")}
            disabled={disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center h-7 w-7 text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border hover:bg-accent shrink-0"
          title="Upload image"
        >
          <ImagePlus className="h-3 w-3" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => setFolderPickerOpen(true)}
          disabled={variant !== "landing"}
          title={
            variant !== "landing"
              ? "Project folder is locked once the session has started"
              : undefined
          }
          className="flex items-center gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[200px]">
            {projectDir || "Select folder"}
          </span>
        </button>
      </div>
      {variant === "landing" && (
        <FolderPickerDialog
          open={folderPickerOpen}
          onOpenChange={setFolderPickerOpen}
          onSelect={(path) => setProjectDir(path)}
          initialPath={projectDir || undefined}
        />
      )}
    </form>
  );
}
