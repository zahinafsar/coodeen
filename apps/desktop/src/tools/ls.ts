import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, relative, basename, dirname } from "node:path";
import fg from "fast-glob";
import { truncateOutput } from "./truncation.js";

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/target/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/.idea/**",
  "**/.vscode/**",
  "**/coverage/**",
  "**/.cache/**",
  "**/tmp/**",
  "**/temp/**",
  "**/logs/**",
  "**/.next/**",
  "**/.turbo/**",
];

const FILE_LIMIT = 100;

export const createLsTool = (projectDir: string) =>
  tool({
    description:
      "List files and directories in a tree view. " +
      "Ignores common noise directories (node_modules, .git, dist, etc). " +
      "Limited to 100 files. Use glob or grep for targeted searches.",
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .describe(
          "Absolute or project-relative directory path (default: project root)"
        ),
    }),
    execute: async ({ path }) => {
      try {
        const searchPath = resolve(projectDir, path || ".");

        const matches = await fg("**/*", {
          cwd: searchPath,
          dot: false,
          onlyFiles: true,
          ignore: IGNORE_PATTERNS,
        });

        const files = matches.slice(0, FILE_LIMIT).sort();

        if (files.length === 0) {
          return `${searchPath}/\n  (empty)`;
        }

        // Build directory tree
        const dirs = new Set<string>();
        const filesByDir = new Map<string, string[]>();

        for (const file of files) {
          const dir = dirname(file);
          const parts = dir === "." ? [] : dir.split("/");

          // Register all parent directories
          for (let i = 0; i <= parts.length; i++) {
            const dirPath = i === 0 ? "." : parts.slice(0, i).join("/");
            dirs.add(dirPath);
          }

          if (!filesByDir.has(dir)) filesByDir.set(dir, []);
          filesByDir.get(dir)!.push(basename(file));
        }

        function renderDir(dirPath: string, depth: number): string {
          const indent = "  ".repeat(depth);
          let output = "";

          if (depth > 0) {
            output += `${indent}${basename(dirPath)}/\n`;
          }

          const childIndent = "  ".repeat(depth + 1);

          // Subdirectories first
          const children = Array.from(dirs)
            .filter((d) => dirname(d) === dirPath && d !== dirPath)
            .sort();

          for (const child of children) {
            output += renderDir(child, depth + 1);
          }

          // Then files
          const dirFiles = filesByDir.get(dirPath) || [];
          for (const f of dirFiles.sort()) {
            output += `${childIndent}${f}\n`;
          }

          return output;
        }

        const relPath = relative(projectDir, searchPath) || ".";
        let output = `${relPath}/\n${renderDir(".", 0)}`;

        if (matches.length > FILE_LIMIT) {
          output += `\n(showing ${FILE_LIMIT} of ${matches.length} files — use glob for targeted search)`;
        }

        return truncateOutput(output);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error listing directory: ${message}]`;
      }
    },
  });
