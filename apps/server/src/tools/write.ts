import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, dirname } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

export const createWriteTool = (projectDir: string) =>
  tool({
    description:
      "Writes a file to the local filesystem. " +
      "This tool will overwrite the existing file if there is one at the provided path. " +
      "If this is an existing file, you MUST use the read tool first to read the file's contents. " +
      "ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required. " +
      "NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the user.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute or project-relative path to write to"),
      content: z.string().describe("The full content to write to the file"),
    }),
    execute: async ({ file_path, content }) => {
      try {
        const resolved = resolve(projectDir, file_path);

        await mkdir(dirname(resolved), { recursive: true });
        await writeFile(resolved, content, "utf-8");

        return `Wrote ${content.split("\n").length} lines to ${file_path}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error writing file: ${message}]`;
      }
    },
  });
