import { tool } from "ai";
import { z } from "zod/v4";
import fg from "fast-glob";
import { resolve, relative } from "node:path";
import { truncateOutput } from "./truncation.js";

export const createGlobTool = (projectDir: string) =>
  tool({
    description:
      "Fast file pattern matching tool that works with any codebase size. " +
      'Supports glob patterns like "**/*.js" or "src/**/*.ts". ' +
      "Returns matching file paths sorted by modification time. " +
      "Use this tool when you need to find files by name patterns. " +
      "It is always better to speculatively perform multiple searches in parallel if they are potentially useful.",
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern to match files (e.g. "**/*.ts", "src/**/*.tsx")'),
    }),
    execute: async ({ pattern }) => {
      try {
        const absProjectDir = resolve(projectDir);

        const matches = await fg(pattern, {
          cwd: absProjectDir,
          dot: false,
          onlyFiles: true,
          ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
          stats: true,
        });

        // Sort by modification time (newest first) like OpenCode
        matches.sort((a, b) => (b.stats?.mtimeMs ?? 0) - (a.stats?.mtimeMs ?? 0));

        const relativePaths = matches.map((m) => relative(absProjectDir, resolve(absProjectDir, m.path)));

        if (relativePaths.length === 0) return "No files matched the pattern.";
        return truncateOutput(relativePaths.join("\n"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error globbing pattern: ${message}]`;
      }
    },
  });
