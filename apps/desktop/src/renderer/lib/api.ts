import type { Session, Message, SSEEvent, SkillInfo } from "./types";

const electron = window.electronAPI;

export interface Provider {
  id: string;
  apiKey: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelsResponse {
  provider: string;
  models: string[];
}

export interface ConnectedModelsItem {
  providerId: string;
  label: string;
  models: string[];
  free?: boolean;
}

export interface FreeModel {
  id: string;
  name: string;
  input: string[];
}

export interface ModelsConfig {
  providers: Record<string, { label: string; models: { id: string; input: string[] }[] }>;
  free: {
    provider: string;
    label: string;
    baseURL: string;
    models: FreeModel[];
  };
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

  getProviders: () => electron.providers.list(),

  getModels: (providerName: string) =>
    electron.providers.models(providerName),

  getConnectedModels: () => electron.providers.connectedModels(),

  getFreeModels: () => electron.providers.freeModels(),

  getModelsConfig: () => electron.providers.config(),

  saveProvider: (id: string, data: { apiKey: string }) =>
    electron.providers.upsert(id, data),

  deleteProvider: (id: string) => electron.providers.delete(id),

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

  // ── Streaming Chat ────────────────────────────────────────

  streamChat: (
    sessionId: string,
    prompt: string,
    providerId: string,
    modelId: string,
    projectDir?: string,
    images?: string[],
    mode?: string,
    _signal?: AbortSignal,
  ) => {
    // Start the stream in main process
    electron.chat.stream({
      sessionId,
      prompt,
      providerId,
      modelId,
      projectDir,
      images,
      mode,
    });

    // Set up event listener for streaming events
    let eventQueue: SSEEvent[] = [];
    let resolve: ((value: IteratorResult<SSEEvent>) => void) | null = null;
    let done = false;

    const cleanup = electron.chat.onEvent((data) => {
      if (data.sessionId !== sessionId) return;

      const event = data.event as SSEEvent;

      if (event.type === "done" || event.type === "error") {
        if (resolve) {
          resolve({ value: event, done: false });
          resolve = null;
        } else {
          eventQueue.push(event);
        }
        // Mark as done after delivering the final event
        setTimeout(() => {
          done = true;
          if (resolve) {
            resolve({ value: undefined as unknown as SSEEvent, done: true });
            resolve = null;
          }
        }, 0);
        return;
      }

      if (resolve) {
        resolve({ value: event, done: false });
        resolve = null;
      } else {
        eventQueue.push(event);
      }
    });

    const iterator: AsyncIterableIterator<SSEEvent> = {
      next() {
        if (eventQueue.length > 0) {
          return Promise.resolve({
            value: eventQueue.shift()!,
            done: false,
          });
        }
        if (done) {
          cleanup();
          return Promise.resolve({
            value: undefined as unknown as SSEEvent,
            done: true,
          });
        }
        return new Promise<IteratorResult<SSEEvent>>((r) => {
          resolve = r;
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };

    return {
      [Symbol.asyncIterator]: () => iterator,
      abort: () => {
        electron.chat.stop(sessionId);
        done = true;
        cleanup();
        if (resolve) {
          resolve({
            value: undefined as unknown as SSEEvent,
            done: true,
          });
          resolve = null;
        }
      },
    };
  },

  // ── Skills ──────────────────────────────────────────────

  getSkills: () => electron.skills.list(),

  createSkill: (name: string, description: string, content: string) =>
    electron.skills.create(name, description, content),

  createSkillRaw: (slug: string, raw: string) =>
    electron.skills.createRaw(slug, raw),

  deleteSkill: (name: string) => electron.skills.delete(name),

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
};
