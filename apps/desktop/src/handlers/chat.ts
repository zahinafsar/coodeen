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
        console.log(
          "[chat:prompt] sending",
          { sessionId, providerId, modelId, projectDir },
        );
        const result = await client.session.prompt({
          path: { id: sessionId },
          body: {
            model: { providerID: providerId, modelID: modelId },
            parts: buildParts(prompt, images),
          },
          ...dirOptions(projectDir),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        // heyapi client does not throw on HTTP errors by default — surface them.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any;
        if (r?.error) {
          const msg =
            r.error?.data?.message ??
            r.error?.message ??
            (typeof r.error === "string" ? r.error : "Prompt failed");
          console.error("[chat:prompt] error:", r.error);
          return { ok: false, error: String(msg) };
        }
        if (r?.response && !r.response.ok) {
          const msg = `Prompt failed: ${r.response.status} ${r.response.statusText}`;
          console.error("[chat:prompt]", msg, r);
          return { ok: false, error: msg };
        }
        console.log(
          "[chat:prompt] ok, status:",
          r?.response?.status,
          "data keys:",
          r?.data ? Object.keys(r.data) : "none",
        );
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[chat:prompt] threw:", err);
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
      } catch {
        // ignore — sidecar may already be idle
      }
      return { ok: true };
    },
  );

  ipcMain.handle("opencode:reconnect", () => {
    reconnectEventBus();
    return { ok: true };
  });
}
