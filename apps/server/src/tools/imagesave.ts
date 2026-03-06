import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, dirname } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

/**
 * In-memory store for images attached to the current request.
 * Set by the agent before tool creation, keyed by session ID.
 */
export const sessionImages = new Map<string, string[]>();

export const createImageSaveTool = (projectDir: string, sessionId: string) =>
  tool({
    description:
      "Save an image from the current conversation to a file. " +
      "Use this when the user drops/pastes an image and asks you to save, use, or place it in the project. " +
      "The image_index refers to the order of images attached to the user's message (0-based). " +
      "Supports common formats: png, jpg, gif, webp, svg.",
    inputSchema: z.object({
      image_index: z
        .number()
        .describe("Index of the image from the user's message (0-based, first image = 0)"),
      file_path: z
        .string()
        .describe("Project-relative or absolute path to save the image to (e.g. 'public/logo.png')"),
    }),
    execute: async ({ image_index, file_path }) => {
      try {
        const images = sessionImages.get(sessionId);
        if (!images || images.length === 0) {
          return `[Error: No images attached to the current message]`;
        }

        if (image_index < 0 || image_index >= images.length) {
          return `[Error: Invalid image_index ${image_index}. ${images.length} image(s) available (0-${images.length - 1})]`;
        }

        const dataUrl = images[image_index];

        // Parse data URL: "data:image/png;base64,iVBOR..."
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          return `[Error: Image is not in base64 data URL format]`;
        }

        const buffer = Buffer.from(match[2], "base64");
        const resolved = resolve(projectDir, file_path);

        await mkdir(dirname(resolved), { recursive: true });
        await writeFile(resolved, buffer);

        const sizeKB = Math.round(buffer.length / 1024);
        return `Saved image (${sizeKB}KB) to ${file_path}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `[Error saving image: ${message}]`;
      }
    },
  });
