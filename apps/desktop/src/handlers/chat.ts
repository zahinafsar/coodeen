import { ipcMain } from "electron";
import { getClient, reconnectEventBus, dirOptions } from "./opencode.js";
import { setPrefs } from "./session-prefs.js";

type PartInput =
  | { type: "text"; text: string }
  | { type: "file"; mime: string; url: string; filename?: string };

function buildParts(prompt: string, images?: string[]): PartInput[] {
  const parts: PartInput[] = [];
  if (images) {
    for (const dataUrl of images) {
      const m = dataUrl.match(/^data:([^;]+);/);
      parts.push({ type: "file", mime: m?.[1] ?? "image/png", url: dataUrl });
    }
  }
  parts.push({ type: "text", text: prompt });
  return parts;
}

export function registerChatHandlers() {
  ipcMain.handle(
    "chat:prompt",
    async (
      _e,
      params: {
        sessionId: string;
        prompt: string;
        providerId: string;
        modelId: string;
        projectDir?: string;
        images?: string[];
      },
    ) => {
      const { sessionId, prompt, providerId, modelId, projectDir, images } =
        params;
      setPrefs(sessionId, { providerId, modelId });

      try {
        const client = getClient();
        const result = await client.session.prompt({
          path: { id: sessionId },
          body: {
            model: { providerID: providerId, modelID: modelId },
            parts: buildParts(prompt, images),
          },
          ...dirOptions(projectDir),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any;
        if (r?.error) {
          const msg =
            r.error?.data?.message ??
            r.error?.message ??
            (typeof r.error === "string" ? r.error : "Prompt failed");
          return { ok: false, error: String(msg) };
        }
        if (r?.response && !r.response.ok) {
          const msg = `Prompt failed: ${r.response.status} ${r.response.statusText}`;
          return { ok: false, error: msg };
        }
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    },
  );

  ipcMain.handle(
    "chat:stop",
    async (_e, sessionId: string, projectDir?: string) => {
      try {
        await getClient().session.abort({
          path: { id: sessionId },
          ...dirOptions(projectDir),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      } catch {}
      return { ok: true };
    },
  );

  ipcMain.handle("opencode:reconnect", () => {
    reconnectEventBus();
    return { ok: true };
  });
}
