import { ipcMain } from "electron";
import { sessionDb } from "../db/sessions.js";
import { messageDb } from "../db/messages.js";

export function registerSessionHandlers() {
  ipcMain.handle("sessions:list", () => {
    return sessionDb.list();
  });

  ipcMain.handle("sessions:get", (_e, id: string) => {
    return sessionDb.get(id);
  });

  ipcMain.handle(
    "sessions:create",
    (_e, data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    }) => {
      return sessionDb.create({
        title: data.title ?? "New Session",
        providerId: data.providerId,
        modelId: data.modelId,
        projectDir: data.projectDir,
        previewUrl: data.previewUrl,
      });
    },
  );

  ipcMain.handle(
    "sessions:update",
    (_e, id: string, data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    }) => {
      return sessionDb.update(id, data);
    },
  );

  ipcMain.handle("sessions:delete", (_e, id: string) => {
    sessionDb.delete(id);
    return { ok: true };
  });

  ipcMain.handle("sessions:getMessages", (_e, sessionId: string) => {
    return messageDb.listBySession(sessionId);
  });
}
