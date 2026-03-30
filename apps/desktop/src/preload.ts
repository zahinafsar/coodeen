import { contextBridge, ipcRenderer } from "electron";

export type ElectronAPI = typeof electronAPI;

const electronAPI = {
  // ── Sessions ──────────────────────────────────────────
  sessions: {
    list: () => ipcRenderer.invoke("sessions:list"),
    get: (id: string) => ipcRenderer.invoke("sessions:get", id),
    create: (data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    }) => ipcRenderer.invoke("sessions:create", data),
    update: (
      id: string,
      data: {
        title?: string;
        providerId?: string;
        modelId?: string;
        projectDir?: string;
        previewUrl?: string;
      },
    ) => ipcRenderer.invoke("sessions:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("sessions:delete", id),
    getMessages: (sessionId: string) =>
      ipcRenderer.invoke("sessions:getMessages", sessionId),
  },

  // ── Chat ──────────────────────────────────────────────
  chat: {
    stream: (params: {
      sessionId: string;
      prompt: string;
      providerId: string;
      modelId: string;
      projectDir?: string;
      images?: string[];
      mode?: string;
    }) => ipcRenderer.invoke("chat:stream", params),
    stop: (sessionId: string) =>
      ipcRenderer.invoke("chat:stop", sessionId),
    onEvent: (
      callback: (data: {
        sessionId: string;
        event: {
          type: string;
          [key: string]: unknown;
        };
      }) => void,
    ) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) =>
        callback(data as Parameters<typeof callback>[0]);
      ipcRenderer.on("chat:event", handler);
      return () => {
        ipcRenderer.removeListener("chat:event", handler);
      };
    },
  },

  // ── Filesystem ────────────────────────────────────────
  fs: {
    listDirs: (path?: string) =>
      ipcRenderer.invoke("fs:listDirs", path),
    listTree: (path: string) =>
      ipcRenderer.invoke("fs:listTree", path),
    readFile: (path: string) =>
      ipcRenderer.invoke("fs:readFile", path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke("fs:writeFile", path, content),
    createEntry: (path: string, type: "file" | "dir") =>
      ipcRenderer.invoke("fs:createEntry", path, type),
    deleteEntry: (path: string) =>
      ipcRenderer.invoke("fs:deleteEntry", path),
    upload: (dirPath: string, fileName: string, data: ArrayBuffer) =>
      ipcRenderer.invoke("fs:upload", dirPath, fileName, data),
  },

  // ── Git ───────────────────────────────────────────────
  git: {
    status: (dir: string) => ipcRenderer.invoke("git:status", dir),
    branches: (dir: string) =>
      ipcRenderer.invoke("git:branches", dir),
    checkout: (dir: string, branch: string) =>
      ipcRenderer.invoke("git:checkout", dir, branch),
    createBranch: (dir: string, branch: string) =>
      ipcRenderer.invoke("git:createBranch", dir, branch),
    deleteBranch: (dir: string, branch: string, force?: boolean) =>
      ipcRenderer.invoke("git:deleteBranch", dir, branch, force),
    merge: (dir: string, branch: string) =>
      ipcRenderer.invoke("git:merge", dir, branch),
    conflicts: (dir: string) =>
      ipcRenderer.invoke("git:conflicts", dir),
    diff: (dir: string, file?: string) =>
      ipcRenderer.invoke("git:diff", dir, file),
    stage: (dir: string, files: string[]) =>
      ipcRenderer.invoke("git:stage", dir, files),
    unstage: (dir: string, files: string[]) =>
      ipcRenderer.invoke("git:unstage", dir, files),
    commit: (dir: string, message: string) =>
      ipcRenderer.invoke("git:commit", dir, message),
    push: (dir: string) => ipcRenderer.invoke("git:push", dir),
    pull: (dir: string) => ipcRenderer.invoke("git:pull", dir),
    discard: (dir: string, files: string[]) =>
      ipcRenderer.invoke("git:discard", dir, files),
  },

  // ── PTY ───────────────────────────────────────────────
  pty: {
    create: (opts?: {
      cwd?: string;
      command?: string;
      title?: string;
    }) => ipcRenderer.invoke("pty:create", opts),
    write: (id: string, data: string) =>
      ipcRenderer.invoke("pty:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke("pty:resize", id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke("pty:kill", id),
    list: () => ipcRenderer.invoke("pty:list"),
    onData: (
      callback: (data: { id: string; data: string }) => void,
    ) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) =>
        callback(data as { id: string; data: string });
      ipcRenderer.on("pty:data", handler);
      return () => {
        ipcRenderer.removeListener("pty:data", handler);
      };
    },
    onExit: (
      callback: (data: { id: string; exitCode: number }) => void,
    ) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) =>
        callback(data as { id: string; exitCode: number });
      ipcRenderer.on("pty:exit", handler);
      return () => {
        ipcRenderer.removeListener("pty:exit", handler);
      };
    },
  },

  // ── Providers ─────────────────────────────────────────
  providers: {
    list: () => ipcRenderer.invoke("providers:list"),
    models: (providerName: string) =>
      ipcRenderer.invoke("providers:models", providerName),
    connectedModels: () =>
      ipcRenderer.invoke("providers:connectedModels"),
    freeModels: () => ipcRenderer.invoke("providers:freeModels"),
    config: () => ipcRenderer.invoke("providers:config"),
    upsert: (id: string, data: { apiKey: string }) =>
      ipcRenderer.invoke("providers:upsert", id, data),
    delete: (id: string) =>
      ipcRenderer.invoke("providers:delete", id),
  },

  // ── Config ────────────────────────────────────────────
  config: {
    getCwd: () => ipcRenderer.invoke("config:getCwd"),
    getActiveProvider: () =>
      ipcRenderer.invoke("config:getActiveProvider"),
    setActiveProvider: (value: string) =>
      ipcRenderer.invoke("config:setActiveProvider", value),
  },

  // ── Actions ───────────────────────────────────────────
  actions: {
    getConfig: (dir: string) =>
      ipcRenderer.invoke("actions:getConfig", dir),
    run: (dir: string, script: string) =>
      ipcRenderer.invoke("actions:run", dir, script),
  },

  // ── Capture ────────────────────────────────────────────
  captureArea: (x: number, y: number, width: number, height: number) =>
    ipcRenderer.invoke("capture:area", x, y, width, height),

  // ── Skills ────────────────────────────────────────────
  skills: {
    list: () => ipcRenderer.invoke("skills:list"),
    create: (name: string, description: string, content: string) =>
      ipcRenderer.invoke("skills:create", name, description, content),
    createRaw: (slug: string, raw: string) =>
      ipcRenderer.invoke("skills:createRaw", slug, raw),
    delete: (name: string) =>
      ipcRenderer.invoke("skills:delete", name),
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
