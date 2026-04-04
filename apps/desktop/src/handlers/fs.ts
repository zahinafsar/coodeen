import { ipcMain } from "electron";
import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  stat,
  rm,
} from "node:fs/promises";
import { resolve, dirname, extname, join } from "node:path";
import { homedir } from "node:os";

const HIDDEN = new Set([
  "node_modules",
  ".git",
  ".next",
  ".cache",
  ".Trash",
  "__pycache__",
  ".tox",
  ".venv",
  "dist",
  ".turbo",
  ".DS_Store",
]);

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".toml": "toml",
  ".ini": "ini",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".svg": "xml",
  ".dockerfile": "dockerfile",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".dart": "dart",
  ".lua": "lua",
  ".r": "r",
  ".vue": "html",
  ".svelte": "html",
};

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".avif",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".exe", ".dll", ".so", ".dylib",
  ".sqlite", ".db",
]);

function isBinary(name: string): boolean {
  return BINARY_EXTS.has(extname(name).toLowerCase());
}

function detectLanguage(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower === ".gitignore" || lower === ".dockerignore") return "plaintext";
  return EXT_LANG[extname(lower)] || "plaintext";
}

export function registerFsHandlers() {
  ipcMain.handle("fs:listDirs", async (_e, path?: string) => {
    const current = resolve(path || homedir());
    const parent = dirname(current) !== current ? dirname(current) : null;

    try {
      const entries = await readdir(current, { withFileTypes: true });
      const dirs = entries
        .filter(
          (e) =>
            e.isDirectory() &&
            !e.name.startsWith(".") &&
            !HIDDEN.has(e.name),
        )
        .map((e) => e.name)
        .sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" }),
        );

      return { current, parent, dirs };
    } catch {
      throw new Error(`Cannot read directory: ${current}`);
    }
  });

  ipcMain.handle("fs:listTree", async (_e, path: string) => {
    const dirPath = resolve(path);

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const result: Array<{ name: string; type: "file" | "dir" }> = [];

      for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".env") continue;
        if (HIDDEN.has(entry.name)) continue;

        if (entry.isDirectory()) {
          result.push({ name: entry.name, type: "dir" });
        } else if (entry.isFile()) {
          result.push({ name: entry.name, type: "file" });
        }
      }

      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
      });

      return { entries: result };
    } catch {
      throw new Error(`Cannot read directory: ${dirPath}`);
    }
  });

  ipcMain.handle("fs:readFile", async (_e, path: string) => {
    const filePath = resolve(path);

    try {
      const s = await stat(filePath);
      if (!s.isFile()) throw new Error("Not a file");

      if (isBinary(filePath)) {
        return { binary: true, size: s.size };
      }

      if (s.size > 2 * 1024 * 1024) {
        throw new Error(`File too large (> 2MB), size: ${s.size}`);
      }

      const content = await readFile(filePath, "utf-8");
      const language = detectLanguage(filePath);

      return { content, language };
    } catch (err) {
      throw new Error(
        `Cannot read file: ${filePath} - ${err instanceof Error ? err.message : err}`,
      );
    }
  });

  ipcMain.handle(
    "fs:writeFile",
    async (_e, path: string, content: string) => {
      const filePath = resolve(path);

      try {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, content, "utf-8");
        return { ok: true };
      } catch {
        throw new Error(`Cannot write file: ${filePath}`);
      }
    },
  );

  ipcMain.handle(
    "fs:createEntry",
    async (_e, path: string, type: "file" | "dir") => {
      const targetPath = resolve(path);

      try {
        if (type === "dir") {
          await mkdir(targetPath, { recursive: true });
        } else {
          await mkdir(dirname(targetPath), { recursive: true });
          await writeFile(targetPath, "", "utf-8");
        }
        return { ok: true };
      } catch {
        throw new Error(`Cannot create: ${targetPath}`);
      }
    },
  );

  ipcMain.handle("fs:deleteEntry", async (_e, path: string) => {
    const targetPath = resolve(path);

    try {
      const s = await stat(targetPath);
      await rm(targetPath, { recursive: s.isDirectory(), force: true });
      return { ok: true };
    } catch {
      throw new Error(`Cannot delete: ${targetPath}`);
    }
  });

  ipcMain.handle(
    "fs:upload",
    async (
      _e,
      dirPath: string,
      fileName: string,
      data: ArrayBuffer,
    ) => {
      const targetDir = resolve(dirPath);
      await mkdir(targetDir, { recursive: true });

      const targetPath = join(targetDir, fileName);
      await writeFile(targetPath, Buffer.from(data));

      return { ok: true, name: fileName };
    },
  );
}
