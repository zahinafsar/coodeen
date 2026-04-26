import { ipcMain } from "electron";
import { getClient, getBaseUrl, dirOptions } from "./opencode.js";
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
    const base = getBaseUrl();
    // /session is per-Instance and filters by Instance.project.id.
    // Iterate every known project (Project.list is global) and route
    // per-project via the x-opencode-directory header ONLY — passing
    // ?directory= would also filter SessionTable.directory, which equals
    // Instance.directory (the picked dir) and can differ from
    // Project.worktree when the user picked a subdir of a git root.
    const projRes = await client.project.list();
    const projects = (projRes.data ?? []) as Array<{
      id: string;
      worktree: string;
    }>;

    type Row = {
      id: string;
      title: string;
      directory?: string;
      time?: { created: number; updated: number };
    };

    const fetchProjectSessions = async (worktree: string): Promise<Row[]> => {
      if (!base) return [];
      const r = await fetch(`${base}/session`, {
        headers: {
          "x-opencode-directory": encodeURIComponent(worktree),
        },
      });
      if (!r.ok) {
        console.warn(
          `[sessions:list] ${worktree} → ${r.status} ${r.statusText}`,
        );
        return [];
      }
      return (await r.json()) as Row[];
    };

    const lists = await Promise.all(
      projects.map(async (p) => {
        try {
          const rows = await fetchProjectSessions(p.worktree);
          return rows.map(mergeSession);
        } catch (err) {
          console.warn(
            `[sessions:list] failed for ${p.worktree}:`,
            err instanceof Error ? err.message : err,
          );
          return [];
        }
      }),
    );

    const byId = new Map<string, ReturnType<typeof mergeSession>>();
    for (const s of lists.flat()) byId.set(s.id, s);

    return [...byId.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
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
        // Title write goes through Instance, so route must hit the
        // session's home project — fall back to fetching the session
        // (ID-scoped, instance-agnostic) to discover its directory.
        let dir = data.projectDir;
        if (!dir) {
          try {
            const cur = await client.session.get({ path: { id } });
            dir = (cur.data as { directory?: string } | undefined)?.directory;
          } catch {}
        }
        await client.session.update({
          path: { id },
          body: { title: data.title },
          ...dirOptions(dir),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
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
