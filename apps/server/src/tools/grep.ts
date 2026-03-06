import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, relative } from "node:path";
import fg from "fast-glob";
import { readFile, stat as fsStat } from "node:fs/promises";
import { truncateOutput } from "./truncation.js";

export const createGrepTool = (projectDir: string) =>
  tool({
    description:
      "Fast content search tool that works with any codebase size. " +
      "Searches file contents using regular expressions. " +
      'Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+"). ' +
      'Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}"). ' +
      "Returns file paths and line numbers with at least one match. " +
      "Use this tool when you need to find files containing specific patterns.",
    inputSchema: z.object({
      pattern: z.string().describe("Regular expression pattern to search for"),
      path: z
        .string()
        .optional()
        .describe("File or directory to search in (default: entire project)"),
      include: z
        .string()
        .optional()
        .describe('Glob pattern to filter files (eg. "*.ts", "*.{js,jsx}")'),
    }),
    execute: async ({ pattern, path, include }) => {
      try {
        const absProjectDir = resolve(projectDir);
        const searchRoot = path ? resolve(absProjectDir, path) : absProjectDir;

        let regex: RegExp;
        try {
          regex = new RegExp(pattern);
        } catch {
          return `[Error: Invalid regex pattern: ${pattern}]`;
        }

        let isFile = false;
        try {
          const s = await fsStat(searchRoot);
          isFile = s.isFile();
        } catch {
          // Path doesn't exist — treat as directory and let glob handle it
        }

        let files: string[];

        if (isFile) {
          files = [searchRoot];
        } else {
          const globPattern = include || "**/*";
          files = await fg(globPattern, {
            cwd: searchRoot,
            dot: false,
            onlyFiles: true,
            ignore: [
              "**/node_modules/**",
              "**/.git/**",
              "**/dist/**",
              "**/build/**",
              "**/*.png",
              "**/*.jpg",
              "**/*.gif",
              "**/*.ico",
              "**/*.woff",
              "**/*.woff2",
              "**/*.ttf",
              "**/*.eot",
              "**/*.mp4",
              "**/*.webm",
              "**/*.zip",
              "**/*.tar",
              "**/*.gz",
            ],
          });
          files = files.map((f) => resolve(searchRoot, f));
        }

        // Collect all matches grouped by file
        const matchesByFile = new Map<string, Array<{ line: number; content: string }>>();
        let totalMatches = 0;

        for (const filePath of files) {
          try {
            const content = await readFile(filePath, "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                const relPath = relative(absProjectDir, filePath);
                if (!matchesByFile.has(relPath)) matchesByFile.set(relPath, []);
                matchesByFile.get(relPath)!.push({
                  line: i + 1,
                  content: lines[i].trim(),
                });
                totalMatches++;
              }
            }
          } catch {
            // Skip binary/unreadable files
          }
        }

        if (totalMatches === 0) {
          return "No matches found.";
        }

        // Build grouped output
        const outputLines = [`Found ${totalMatches} matches`];

        for (const [filePath, matches] of matchesByFile) {
          outputLines.push("");
          outputLines.push(`${filePath}:`);
          for (const m of matches) {
            outputLines.push(`  Line ${m.line}: ${m.content}`);
          }
        }

        // truncateOutput handles the 2000 lines / 50KB cap
        return truncateOutput(outputLines.join("\n"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error searching files: ${message}]`;
      }
    },
  });
