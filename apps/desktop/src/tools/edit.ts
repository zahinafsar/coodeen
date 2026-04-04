import { tool } from "ai";
import { z } from "zod/v4";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export const createEditTool = (projectDir: string) =>
  tool({
    description:
      "Performs exact string replacements in files. " +
      "You must use the read tool at least once before editing a file. " +
      "When editing text from read tool output, preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. " +
      "The line number prefix format is: line number + colon + space. Everything after that space is the actual file content to match. " +
      "ALWAYS prefer editing existing files. NEVER write new files unless explicitly required. " +
      "The edit will FAIL if old_string is not found in the file. " +
      "The edit will FAIL if old_string is found multiple times — provide more surrounding context to make it unique, or use replace_all. " +
      "Use replace_all for replacing and renaming strings across the file.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute or project-relative path to the file to edit"),
      old_string: z.string().describe("The exact text to find (must match file content exactly, including whitespace and indentation)"),
      new_string: z.string().describe("The replacement text (must be different from old_string)"),
      replace_all: z.boolean().optional().describe("Replace all occurrences of old_string (default: false)"),
    }),
    execute: async ({ file_path, old_string, new_string, replace_all }) => {
      try {
        const resolved = resolve(projectDir, file_path);
        const content = await readFile(resolved, "utf-8");

        if (old_string === new_string) {
          return `[Error: old_string and new_string are identical]`;
        }

        const occurrences = content.split(old_string).length - 1;

        if (occurrences === 0) {
          return `[Error: old_string not found in ${file_path}. Make sure it matches the file content exactly, including whitespace and indentation.]`;
        }

        if (occurrences > 1 && !replace_all) {
          return `[Error: Found ${occurrences} matches for old_string. Provide more surrounding lines to identify the correct match, or use replace_all to change every instance.]`;
        }

        const updated = replace_all
          ? content.replaceAll(old_string, new_string)
          : content.replace(old_string, new_string);
        await writeFile(resolved, updated, "utf-8");

        const count = replace_all ? occurrences : 1;
        return `Edited ${file_path}: replaced ${count} occurrence${count > 1 ? "s" : ""}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error editing file: ${message}]`;
      }
    },
  });
