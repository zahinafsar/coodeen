import { ipcMain } from "electron";
import { getClient, dirOptions } from "./opencode.js";
import { getPrefs, setPrefs, deletePrefs, allPrefs } from "./session-prefs.js";

function mergeSession(s: {
  id: string;
  title: string;
  directory?: string;
  time?: { created: number; updated: number };
}) {
  const prefs = getPrefs(s.id);
  return {
    id: s.id,
    title: s.title,
    projectDir: s.directory ?? null,
    providerId: prefs.providerId ?? null,
    modelId: prefs.modelId ?? null,
    previewUrl: prefs.previewUrl ?? null,
    createdAt: s.time ? new Date(s.time.created).toISOString() : "",
    updatedAt: s.time ? new Date(s.time.updated).toISOString() : "",
  };
}

export function registerSessionHandlers() {
  ipcMain.handle("sessions:list", async () => {
    const client = getClient();
    const res = await client.session.list();
    const list = (res.data ?? []) as Array<{
      id: string;
      title: string;
      directory?: string;
      time?: { created: number; updated: number };
    }>;
    return list
      .map(mergeSession)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  });

  ipcMain.handle("sessions:get", async (_e, id: string) => {
    const client = getClient();
    const res = await client.session.get({ path: { id } });
    if (!res.data) return null;
    return mergeSession(res.data as {
      id: string;
      title: string;
      directory?: string;
      time?: { created: number; updated: number };
    });
  });

  ipcMain.handle(
    "sessions:create",
    async (_e, data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    }) => {
      const client = getClient();
      const res = await client.session.create({
        body: { title: data.title ?? "New Session" },
        ...dirOptions(data.projectDir),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = res as any;
      if (r?.error || (r?.response && !r.response.ok)) {
        const msg =
          r.error?.data?.message ??
          r.error?.message ??
          `Failed to create session (${r.response?.status ?? "?"})`;
        throw new Error(String(msg));
      }
      const s = r.data as {
        id: string;
        title: string;
        directory?: string;
        time?: { created: number; updated: number };
      };
      if (!s?.id) throw new Error("Session create returned no id");
      if (data.providerId || data.modelId || data.previewUrl) {
        setPrefs(s.id, {
          providerId: data.providerId,
          modelId: data.modelId,
          previewUrl: data.previewUrl,
        });
      }
      return mergeSession(s);
    },
  );

  ipcMain.handle(
    "sessions:update",
    async (_e, id: string, data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    }) => {
      const client = getClient();
      if (data.title !== undefined) {
        await client.session.update({
          path: { id },
          body: { title: data.title },
          query: data.projectDir ? { directory: data.projectDir } : undefined,
        });
      }
      if (
        data.providerId !== undefined ||
        data.modelId !== undefined ||
        data.previewUrl !== undefined
      ) {
        setPrefs(id, {
          providerId: data.providerId,
          modelId: data.modelId,
          previewUrl: data.previewUrl,
        });
      }
      const res = await client.session.get({ path: { id } });
      return res.data
        ? mergeSession(res.data as {
            id: string;
            title: string;
            directory?: string;
            time?: { created: number; updated: number };
          })
        : null;
    },
  );

  ipcMain.handle("sessions:delete", async (_e, id: string) => {
    const client = getClient();
    await client.session.delete({ path: { id } });
    deletePrefs(id);
    return { ok: true };
  });

  ipcMain.handle("sessions:getMessages", async (_e, sessionId: string) => {
    const client = getClient();
    const res = await client.session.messages({ path: { id: sessionId } });
    return res.data ?? [];
  });

  ipcMain.handle("sessions:allPrefs", () => allPrefs());
}
