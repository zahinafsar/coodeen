import { tool } from "ai";
import { z } from "zod/v4";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const DEFAULT_TIMEOUT = 30_000;

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
};

export const createImageFetchTool = (supportsVision: boolean) =>
  tool({
    description:
      "Fetch an image from a URL, save it to a temp file, and return the file path. " +
      "Use this when you need to download or inspect an image from a URL. " +
      "Supports PNG, JPEG, GIF, WebP, SVG (max 20MB).",
    inputSchema: z.object({
      url: z.string().describe("The image URL to fetch"),
    }),
    execute: async ({ url }) => {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "image/*,*/*",
          },
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timer);

        if (!res.ok) {
          return `[Error: Request failed with status ${res.status}]`;
        }

        const contentType = res.headers.get("content-type") || "";
        const mime = contentType.split(";")[0].trim();
        if (!mime.startsWith("image/")) {
          return `[Error: URL did not return an image (content-type: ${contentType})]`;
        }

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
          return `[Error: Image too large (exceeds 20MB)]`;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.byteLength > MAX_IMAGE_SIZE) {
          return `[Error: Image too large (exceeds 20MB)]`;
        }

        const ext = MIME_TO_EXT[mime] || ".bin";
        const dir = join(tmpdir(), "coodeen-images");
        await mkdir(dir, { recursive: true });
        const filePath = join(dir, `${randomUUID()}${ext}`);
        await writeFile(filePath, buffer);

        const sizeKB = Math.round(buffer.byteLength / 1024);
        return `Image saved to ${filePath} (${mime}, ${sizeKB}KB)`;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof Error && error.name === "AbortError") {
          return `[Error: Image fetch timed out after ${DEFAULT_TIMEOUT / 1000}s]`;
        }
        return `[Error: ${error instanceof Error ? error.message : error}]`;
      }
    },
  });
