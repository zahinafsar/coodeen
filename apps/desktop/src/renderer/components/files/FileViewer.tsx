import { useState, useEffect, useCallback, useRef } from "react";
import { Save, FileWarning, AtSign } from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";

import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-less";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-objectivec";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-php";
import "prismjs/components/prism-dart";
import "prismjs/components/prism-lua";
import "prismjs/components/prism-r";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-perl";
import "prismjs/components/prism-scala";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-protobuf";
import "prismjs/components/prism-clojure";
import "prismjs/components/prism-hcl";

import "prismjs/themes/prism-tomorrow.css";

import { Button } from "@/components/ui/button";
import type { FileReference } from "../../lib/types";

interface FileViewerProps {
  filePath: string | null;
  onFileReference?: (ref: FileReference) => void;
}

interface FileData {
  content: string;
  language: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function detectLanguage(filePath: string): string {
  const name = filePath.split("/").pop()?.toLowerCase() ?? "";
  const ext = name.includes(".") ? "." + name.split(".").pop() : "";

  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "docker";
  if (name === ".env" || name.startsWith(".env.")) return "bash";
  if (name === ".gitignore" || name === ".dockerignore" || name === ".editorconfig")
    return "plaintext";
  if (name === "tsconfig.json" || name === "jsconfig.json") return "json";

  const EXT_MAP: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".mts": "typescript",
    ".cts": "typescript",

    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",

    ".vue": "markup",
    ".svelte": "markup",
    ".astro": "markup",

    ".html": "markup",
    ".htm": "markup",
    ".css": "css",
    ".scss": "scss",
    ".sass": "scss",
    ".less": "less",

    ".json": "json",
    ".jsonc": "json",
    ".json5": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".ini": "ini",
    ".xml": "markup",
    ".svg": "markup",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".prisma": "graphql",

    ".md": "markdown",
    ".mdx": "markdown",
    ".rmd": "markdown",

    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".fish": "bash",

    ".py": "python",
    ".pyi": "python",
    ".pyw": "python",

    ".rs": "rust",

    ".go": "go",

    ".java": "java",
    ".kt": "kotlin",
    ".kts": "kotlin",

    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hxx": "cpp",
    ".cs": "csharp",
    ".m": "objectivec",

    ".swift": "swift",

    ".rb": "ruby",
    ".rake": "ruby",
    ".gemspec": "ruby",

    ".php": "php",

    ".dart": "dart",

    ".lua": "lua",

    ".r": "r",

    ".sql": "sql",

    ".pl": "perl",
    ".pm": "perl",

    ".scala": "scala",

    ".clj": "clojure",
    ".cljs": "clojure",
    ".cljc": "clojure",

    ".ps1": "powershell",
    ".psm1": "powershell",

    ".dockerfile": "docker",

    ".tf": "hcl",
    ".hcl": "hcl",
    ".proto": "protobuf",
    ".txt": "plaintext",
    ".log": "plaintext",
    ".csv": "plaintext",
  };

  return EXT_MAP[ext] ?? "plaintext";
}

const FONT_FAMILY =
  "'Fira Code', 'Fira Mono', Menlo, Consolas, 'Courier New', monospace";

export function FileViewer({ filePath, onFileReference }: FileViewerProps) {
  const [code, setCode] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [isBinary, setIsBinary] = useState(false);
  const [binarySize, setBinarySize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const dirty = code !== originalCode;
  const lang = filePath ? detectLanguage(filePath) : "plaintext";
  const fileName = filePath?.split("/").pop() ?? "";

  useEffect(() => {
    if (!filePath) {
      setCode("");
      setOriginalCode("");
      setIsBinary(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    window.electronAPI.fs
      .readFile(filePath)
      .then((data) => {
        if ("binary" in data && data.binary) {
          setIsBinary(true);
          setBinarySize(data.size);
          setCode("");
          setOriginalCode("");
        } else {
          setIsBinary(false);
          const fd = data as FileData;
          setCode(fd.content);
          setOriginalCode(fd.content);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load file");
      })
      .finally(() => setLoading(false));
  }, [filePath]);

  const highlightCode = useCallback(
    (value: string) => {
      if (value.length > 100_000) return escapeHtml(value);
      if (lang === "plaintext" || !Prism.languages[lang]) {
        return escapeHtml(value);
      }
      return Prism.highlight(value, Prism.languages[lang], lang);
    },
    [lang],
  );

  const handleSave = useCallback(async () => {
    if (!filePath || !dirty) return;
    setSaving(true);
    try {
      await window.electronAPI.fs.writeFile(filePath, code);
      setOriginalCode(code);
    } catch {
      void 0;
    } finally {
      setSaving(false);
    }
  }, [filePath, code, dirty]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        if (containerRef.current?.contains(document.activeElement)) {
          e.preventDefault();
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  const handleReference = useCallback(() => {
    const textarea = containerRef.current?.querySelector("textarea");
    if (!textarea || !filePath || !onFileReference) return;

    const { selectionStart, selectionEnd, value } = textarea;
    if (selectionStart === selectionEnd) return;

    const selectedText = value.substring(selectionStart, selectionEnd);
    const beforeSelection = value.substring(0, selectionStart);
    const startLine = (beforeSelection.match(/\n/g) || []).length + 1;
    const endLine =
      startLine + (selectedText.match(/\n/g) || []).length;

    onFileReference({
      filePath,
      startLine,
      endLine,
      content: selectedText,
    });
  }, [filePath, onFileReference]);

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Select a file to view
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <FileWarning className="h-8 w-8 text-amber-500" />
        <p>{error}</p>
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-muted-foreground">
        <FileWarning className="h-8 w-8" />
        <p>Binary file ({(binarySize / 1024).toFixed(1)} KB)</p>
        <p className="text-xs">Cannot preview binary files</p>
      </div>
    );
  }

  const lineCount = code.split("\n").length;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden"
      tabIndex={-1}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-card shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium truncate">{fileName}</span>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {lang}
          </span>
          {dirty && (
            <span className="text-[10px] text-amber-400 font-medium">
              Modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onFileReference && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-sm"
              onClick={handleReference}
              title="Reference selected code in prompt"
            >
              <AtSign className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant={dirty ? "default" : "ghost"}
            size="icon"
            className="h-6 w-6 rounded-sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            title="Save (Ctrl+S)"
          >
            <Save className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-[#1d1f21]">
        <div className="flex min-h-full">
          <div
            className="shrink-0 select-none text-right text-gray-500 border-r border-gray-700/50 sticky left-0 bg-[#1d1f21]"
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 13,
              lineHeight: "20px",
              paddingTop: 10,
              paddingBottom: 10,
              paddingRight: 12,
              paddingLeft: 12,
              minWidth: 48,
            }}
            aria-hidden
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <Editor
              value={code}
              onValueChange={setCode}
              highlight={highlightCode}
              tabSize={2}
              insertSpaces
              padding={10}
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: 13,
                lineHeight: "20px",
                minHeight: "100%",
                color: "#c5c8c6",
              }}
              textareaClassName="outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
