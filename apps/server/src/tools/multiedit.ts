import { tool } from "ai";
import { z } from "zod/v4";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export const createMultiEditTool = (projectDir: string) =>
  tool({
    description:
      "Make multiple edits to a single file in one operation. " +
      "Prefer this over the edit tool when you need to make multiple changes to the same file. " +
      "Edits are applied sequentially — each edit operates on the result of the previous one. " +
      "All edits must be valid or none are applied (atomic).",
    inputSchema: z.object({
      file_path: z
        .string()
        .describe("Absolute or project-relative path to the file to edit"),
      edits: z
        .array(
          z.object({
            old_string: z
              .string()
              .describe(
                "The exact text to find (must match file content exactly, including whitespace)"
              ),
            new_string: z
              .string()
              .describe("The replacement text (must differ from old_string)"),
            replace_all: z
              .boolean()
              .optional()
              .describe("Replace all occurrences of old_string (default: false)"),
          })
        )
        .min(1)
        .describe("Array of edit operations to apply sequentially"),
    }),
    execute: async ({ file_path, edits }) => {
      try {
        const resolved = resolve(projectDir, file_path);
        let content = await readFile(resolved, "utf-8");

        // Validate all edits first (dry run)
        let dryContent = content;
        for (let i = 0; i < edits.length; i++) {
          const edit = edits[i];
          if (edit.old_string === edit.new_string) {
            return `[Error: edit ${i + 1} — old_string and new_string are identical]`;
          }

          const occurrences = dryContent.split(edit.old_string).length - 1;
          if (occurrences === 0) {
            return `[Error: edit ${i + 1} — old_string not found in ${file_path}. Earlier edits may have changed the content. Verify each edit against the result of the previous one.]`;
          }
          if (occurrences > 1 && !edit.replace_all) {
            return `[Error: edit ${i + 1} — old_string found ${occurrences} times. Use replace_all: true or provide more context to make it unique.]`;
          }

          if (edit.replace_all) {
            dryContent = dryContent.replaceAll(edit.old_string, edit.new_string);
          } else {
            dryContent = dryContent.replace(edit.old_string, edit.new_string);
          }
        }

        // All edits valid — apply for real
        for (const edit of edits) {
          if (edit.replace_all) {
            content = content.replaceAll(edit.old_string, edit.new_string);
          } else {
            content = content.replace(edit.old_string, edit.new_string);
          }
        }

        await writeFile(resolved, content, "utf-8");

        return `Applied ${edits.length} edits to ${file_path}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error editing file: ${message}]`;
      }
    },
  });
