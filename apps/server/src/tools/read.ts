import { tool } from "ai";
import { z } from "zod/v4";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { truncateOutput } from "./truncation.js";

export const createReadTool = (projectDir: string) =>
  tool({
    description:
      "Read a file from the local filesystem. " +
      "The filePath parameter should be an absolute path. " +
      "By default, returns up to 2000 lines from the start of the file. " +
      "Use the offset parameter (1-indexed) to start from a later line. " +
      "Use the grep tool to find specific content in large files. " +
      "If unsure of the correct file path, use the glob tool to look up filenames. " +
      "Contents are returned with each line prefixed by its line number. " +
      "Any line longer than 2000 characters is truncated. " +
      "Call this tool in parallel when you know there are multiple files you want to read. " +
      "Avoid tiny repeated slices (30 line chunks). If you need more context, read a larger window.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute or project-relative path to the file to read"),
      offset: z
        .number()
        .optional()
        .describe("1-based line number to start reading from (default: 1)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of lines to return (default: 2000)"),
    }),
    execute: async ({ file_path, offset, limit }) => {
      try {
        const resolved = resolve(projectDir, file_path);
        const raw = await readFile(resolved, "utf-8");
        let lines = raw.split("\n");

        const start = (offset ?? 1) - 1;
        if (start > 0) lines = lines.slice(start);
        const maxLines = limit ?? 2000;
        const truncated = lines.length > maxLines;
        if (truncated) lines = lines.slice(0, maxLines);

        // Truncate long lines
        lines = lines.map((line) => (line.length > 2000 ? line.substring(0, 2000) + "..." : line));

        const numbered = lines.map((line, i) => `${start + i + 1}: ${line}`).join("\n");

        let result = numbered;
        if (truncated) {
          result += `\n\n[Showing ${maxLines} of ${raw.split("\n").length} lines. Use offset=${start + maxLines + 1} to read more.]`;
        }
        return truncateOutput(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error reading file: ${message}]`;
      }
    },
  });
