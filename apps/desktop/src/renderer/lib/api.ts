import type { CoodeenConfig, Session } from "./types";

const electron = window.electronAPI;

export interface ConnectedModelsItem {
  providerId: string;
  label: string;
  models: string[];
}

export interface DirListResponse {
  current: string;
  parent: string | null;
  dirs: string[];
}

export const api = {
  // ── Config ─────────────────────────────────────────────

  getCwd: () => electron.config.getCwd(),

  // ── Filesystem ──────────────────────────────────────────

  listDirs: (path?: string) => electron.fs.listDirs(path),

  listTree: (path: string) => electron.fs.listTree(path),

  readFile: (path: string) => electron.fs.readFile(path),

  writeFile: (path: string, content: string) =>
    electron.fs.writeFile(path, content),

  createEntry: (path: string, type: "file" | "dir") =>
    electron.fs.createEntry(path, type),

  deleteEntry: (path: string) => electron.fs.deleteEntry(path),

  uploadFile: async (dirPath: string, file: File) => {
    const buffer = await file.arrayBuffer();
    return electron.fs.upload(dirPath, file.name, buffer);
  },

  // ── Providers ──────────────────────────────────────────

  getConnectedModels: () => electron.providers.connectedModels(),

  providerHasKey: (id: string) => electron.providers.hasKey(id),

  setProviderApiKey: (id: string, apiKey: string) =>
    electron.providers.setApiKey(id, apiKey),

  deleteProviderApiKey: (id: string) =>
    electron.providers.deleteApiKey(id),

  // ── Sessions ──────────────────────────────────────────────

  createSession: (opts?: {
    title?: string;
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    previewUrl?: string;
  }) =>
    electron.sessions.create({
      title: opts?.title ?? "New Session",
      providerId: opts?.providerId,
      modelId: opts?.modelId,
      projectDir: opts?.projectDir,
      previewUrl: opts?.previewUrl,
    }),

  updateSession: (
    id: string,
    data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    },
  ) => electron.sessions.update(id, data),

  getSessions: () => electron.sessions.list(),

  deleteSession: (id: string) => electron.sessions.delete(id),

  getMessages: (sessionId: string) =>
    electron.sessions.getMessages(sessionId),

  // ── Git ────────────────────────────────────────────

  getGitStatus: (dir: string) => electron.git.status(dir),

  getGitBranches: (dir: string) => electron.git.branches(dir),

  gitCheckout: (dir: string, branch: string) =>
    electron.git.checkout(dir, branch),

  gitCreateBranch: (dir: string, branch: string) =>
    electron.git.createBranch(dir, branch),

  gitDeleteBranch: (dir: string, branch: string, force: boolean = false) =>
    electron.git.deleteBranch(dir, branch, force),

  gitMerge: (dir: string, branch: string) =>
    electron.git.merge(dir, branch),

  getGitConflicts: (dir: string) => electron.git.conflicts(dir),

  getGitDiff: (dir: string, file?: string) =>
    electron.git.diff(dir, file),

  gitStage: (dir: string, files: string[]) =>
    electron.git.stage(dir, files),

  gitUnstage: (dir: string, files: string[]) =>
    electron.git.unstage(dir, files),

  gitCommit: (dir: string, message: string) =>
    electron.git.commit(dir, message),

  gitPush: (dir: string) => electron.git.push(dir),

  gitPull: (dir: string) => electron.git.pull(dir),

  gitDiscard: (dir: string, files: string[]) =>
    electron.git.discard(dir, files),

  // ── Terminal ────────────────────────────────────────

  createTerminal: (opts?: { cwd?: string; command?: string; title?: string }) =>
    electron.pty.create(opts),

  listTerminals: () => electron.pty.list(),

  deleteTerminal: (id: string) => electron.pty.kill(id),

  resizeTerminal: (id: string, cols: number, rows: number) =>
    electron.pty.resize(id, cols, rows),

  // ── Actions ────────────────────────────────────────

  getActions: (dir: string) => electron.actions.getConfig(dir),

  runAction: (dir: string, script: string) =>
    electron.actions.run(dir, script),

  // ── Coodeen design config ──────────────────────────
  getCoodeen: (dir: string) => electron.coodeen.get(dir),
  setCoodeen: (dir: string, data: CoodeenConfig) =>
    electron.coodeen.set(dir, data),
  watchCoodeen: (dir: string) => electron.coodeen.watch(dir),
  onCoodeenChanged: (cb: (data: { dir: string }) => void) =>
    electron.coodeen.onChanged(cb),
};
