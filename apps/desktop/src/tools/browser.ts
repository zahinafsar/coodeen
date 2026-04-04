import { tool, zodSchema } from "ai";
import { z } from "zod/v4";
import { ipcMain, type BrowserWindow } from "electron";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

const SCREENSHOT_DIR = join(tmpdir(), "coodeen-screenshots");
const ACTION_TIMEOUT = 10_000;

function sendPreviewAction(
  getWindow: () => BrowserWindow | null,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  return new Promise((resolve) => {
    const win = getWindow();
    if (!win) {
      resolve({ success: false, error: "No window available" });
      return;
    }

    const requestId = randomUUID();
    const channel = `preview:action-result:${requestId}`;

    const timeout = setTimeout(() => {
      ipcMain.removeAllListeners(channel);
      resolve({ success: false, error: "Preview action timed out — is the preview panel open?" });
    }, ACTION_TIMEOUT);

    ipcMain.once(channel, (_e, result) => {
      clearTimeout(timeout);
      resolve(result as { success: boolean; data?: Record<string, unknown>; error?: string });
    });

    win.webContents.send("preview:action", { requestId, ...payload });
  });
}

export const createBrowserTool = (
  getWindow: () => BrowserWindow | null,
  supportsVision: boolean,
) =>
  tool({
    description:
      "Interact with the preview iframe. " +
      "Use 'screenshot' to capture the current state of the preview panel. " +
      "Use 'scroll' to scroll the page up/down by pixels or to top/bottom. " +
      "Use 'click' to click an element by CSS selector.",
    inputSchema: zodSchema(
      z.object({
        action: z.enum(["screenshot", "scroll", "click"]).describe(
          "Action to perform: 'screenshot' captures the preview, 'scroll' scrolls the page, 'click' clicks an element",
        ),
        direction: z.enum(["up", "down"]).optional().describe(
          "Scroll direction (required for scroll action)",
        ),
        amount: z.union([
          z.number().describe("Pixels to scroll"),
          z.enum(["top", "bottom"]).describe("Scroll to absolute position"),
        ]).optional().describe(
          "Scroll amount — pixels or 'top'/'bottom' (defaults to 500 for scroll action)",
        ),
        selector: z.string().optional().describe(
          "CSS selector of the element to click (required for click action)",
        ),
      }),
    ),
    execute: async (rawInput) => {
      const input = {
        ...rawInput,
        amount: rawInput.amount ?? (rawInput.action === "scroll" ? 500 : undefined),
        direction: rawInput.direction ?? (rawInput.action === "scroll" ? "down" : undefined),
      };
      if (input.action === "screenshot") {
        // Step 1: Get iframe bounds from renderer
        const boundsResult = await sendPreviewAction(getWindow, { action: "screenshot" });
        if (!boundsResult.success) {
          return { error: boundsResult.error ?? "Failed to get iframe bounds" };
        }

        // Step 2: Capture in main process
        const win = getWindow();
        if (!win) return { error: "No window available" };

        const { x, y, width, height } = boundsResult.data as {
          x: number;
          y: number;
          width: number;
          height: number;
        };

        const image = await win.webContents.capturePage({
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
        });

        // Step 3: Save to temp file
        const pngBuffer = image.toPNG();
        await mkdir(SCREENSHOT_DIR, { recursive: true });
        const fileName = `preview-${Date.now()}.png`;
        const filePath = join(SCREENSHOT_DIR, fileName);
        await writeFile(filePath, pngBuffer);

        return { action: "screenshot" as const, filePath };
      }

      // scroll / click — simple round-trip
      const result = await sendPreviewAction(getWindow, input as Record<string, unknown>);
      if (!result.success) {
        return { error: result.error ?? `${input.action} failed` };
      }
      return { action: input.action, success: true };
    },
    toModelOutput({ output }) {
      if ("error" in output) {
        return {
          type: "text" as const,
          value: `[Browser tool error: ${output.error}]`,
        };
      }

      if (output.action === "screenshot" && "filePath" in output) {
        const filePath = output.filePath as string;

        if (supportsVision) {
          try {
            const data = readFileSync(filePath);
            const base64 = Buffer.from(data).toString("base64");
            return {
              type: "content" as const,
              value: [
                {
                  type: "image-data" as const,
                  data: base64,
                  mediaType: "image/png",
                },
                {
                  type: "text" as const,
                  text: `[File: ${filePath}]`,
                },
              ],
            };
          } catch {
            return {
              type: "text" as const,
              value: `Screenshot saved to ${filePath} but could not read it back.`,
            };
          }
        }

        return {
          type: "text" as const,
          value: `Screenshot saved to ${filePath}. This model does not support vision.`,
        };
      }

      return {
        type: "text" as const,
        value: `${output.action} completed successfully.`,
      };
    },
  });
