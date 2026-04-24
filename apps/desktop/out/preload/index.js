"use strict";
const electron = require("electron");
const electronAPI = {
  // ── Sessions ──────────────────────────────────────────
  sessions: {
    list: () => electron.ipcRenderer.invoke("sessions:list"),
    get: (id) => electron.ipcRenderer.invoke("sessions:get", id),
    create: (data) => electron.ipcRenderer.invoke("sessions:create", data),
    update: (id, data) => electron.ipcRenderer.invoke("sessions:update", id, data),
    delete: (id) => electron.ipcRenderer.invoke("sessions:delete", id),
    getMessages: (sessionId) => electron.ipcRenderer.invoke("sessions:getMessages", sessionId)
  },
  // ── Chat ──────────────────────────────────────────────
  chat: {
    prompt: (params) => electron.ipcRenderer.invoke("chat:prompt", params),
    stop: (sessionId) => electron.ipcRenderer.invoke("chat:stop", sessionId)
  },
  // ── Opencode raw event stream ─────────────────────────
  opencode: {
    onEvent: (callback) => {
      const handler = (_e, data) => callback(data);
      electron.ipcRenderer.on("opencode:event", handler);
      return () => {
        electron.ipcRenderer.removeListener("opencode:event", handler);
      };
    },
    onStatus: (callback) => {
      const handler = (_e, data) => callback(data);
      electron.ipcRenderer.on("opencode:status", handler);
      return () => {
        electron.ipcRenderer.removeListener("opencode:status", handler);
      };
    },
    reconnect: () => electron.ipcRenderer.invoke("opencode:reconnect")
  },
  // ── Filesystem ────────────────────────────────────────
  fs: {
    listDirs: (path) => electron.ipcRenderer.invoke("fs:listDirs", path),
    listTree: (path) => electron.ipcRenderer.invoke("fs:listTree", path),
    readFile: (path) => electron.ipcRenderer.invoke("fs:readFile", path),
    writeFile: (path, content) => electron.ipcRenderer.invoke("fs:writeFile", path, content),
    createEntry: (path, type) => electron.ipcRenderer.invoke("fs:createEntry", path, type),
    deleteEntry: (path) => electron.ipcRenderer.invoke("fs:deleteEntry", path),
    upload: (dirPath, fileName, data) => electron.ipcRenderer.invoke("fs:upload", dirPath, fileName, data)
  },
  // ── Git ───────────────────────────────────────────────
  git: {
    status: (dir) => electron.ipcRenderer.invoke("git:status", dir),
    branches: (dir) => electron.ipcRenderer.invoke("git:branches", dir),
    checkout: (dir, branch) => electron.ipcRenderer.invoke("git:checkout", dir, branch),
    createBranch: (dir, branch) => electron.ipcRenderer.invoke("git:createBranch", dir, branch),
    deleteBranch: (dir, branch, force) => electron.ipcRenderer.invoke("git:deleteBranch", dir, branch, force),
    merge: (dir, branch) => electron.ipcRenderer.invoke("git:merge", dir, branch),
    conflicts: (dir) => electron.ipcRenderer.invoke("git:conflicts", dir),
    diff: (dir, file) => electron.ipcRenderer.invoke("git:diff", dir, file),
    stage: (dir, files) => electron.ipcRenderer.invoke("git:stage", dir, files),
    unstage: (dir, files) => electron.ipcRenderer.invoke("git:unstage", dir, files),
    commit: (dir, message) => electron.ipcRenderer.invoke("git:commit", dir, message),
    push: (dir) => electron.ipcRenderer.invoke("git:push", dir),
    pull: (dir) => electron.ipcRenderer.invoke("git:pull", dir),
    discard: (dir, files) => electron.ipcRenderer.invoke("git:discard", dir, files)
  },
  // ── PTY ───────────────────────────────────────────────
  pty: {
    create: (opts) => electron.ipcRenderer.invoke("pty:create", opts),
    write: (id, data) => electron.ipcRenderer.invoke("pty:write", id, data),
    resize: (id, cols, rows) => electron.ipcRenderer.invoke("pty:resize", id, cols, rows),
    kill: (id) => electron.ipcRenderer.invoke("pty:kill", id),
    list: () => electron.ipcRenderer.invoke("pty:list"),
    onData: (callback) => {
      const handler = (_e, data) => callback(data);
      electron.ipcRenderer.on("pty:data", handler);
      return () => {
        electron.ipcRenderer.removeListener("pty:data", handler);
      };
    },
    onExit: (callback) => {
      const handler = (_e, data) => callback(data);
      electron.ipcRenderer.on("pty:exit", handler);
      return () => {
        electron.ipcRenderer.removeListener("pty:exit", handler);
      };
    }
  },
  // ── Providers ─────────────────────────────────────────
  providers: {
    connectedModels: () => electron.ipcRenderer.invoke("providers:connectedModels"),
    hasKey: (id) => electron.ipcRenderer.invoke("providers:hasKey", id),
    setApiKey: (id, apiKey) => electron.ipcRenderer.invoke("providers:setApiKey", id, apiKey),
    deleteApiKey: (id) => electron.ipcRenderer.invoke("providers:deleteApiKey", id)
  },
  // ── Config ────────────────────────────────────────────
  config: {
    getCwd: () => electron.ipcRenderer.invoke("config:getCwd"),
    getActiveProvider: () => electron.ipcRenderer.invoke("config:getActiveProvider"),
    setActiveProvider: (value) => electron.ipcRenderer.invoke("config:setActiveProvider", value)
  },
  // ── Actions ───────────────────────────────────────────
  actions: {
    getConfig: (dir) => electron.ipcRenderer.invoke("actions:getConfig", dir),
    run: (dir, script) => electron.ipcRenderer.invoke("actions:run", dir, script)
  },
  // ── Capture ────────────────────────────────────────────
  captureArea: (x, y, width, height) => electron.ipcRenderer.invoke("capture:area", x, y, width, height),
  // ── Preview (browser tool) ───────────────────────────
  preview: {
    onAction: (callback) => {
      const handler = (_e, data) => callback(data);
      electron.ipcRenderer.on("preview:action", handler);
      return () => {
        electron.ipcRenderer.removeListener("preview:action", handler);
      };
    },
    sendResult: (requestId, result) => electron.ipcRenderer.send(`preview:action-result:${requestId}`, result)
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
