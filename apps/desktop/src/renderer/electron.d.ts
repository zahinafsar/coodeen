interface ElectronAPI {
  sessions: {
    list: () => Promise<import("./lib/types").Session[]>;
    get: (id: string) => Promise<import("./lib/types").Session | undefined>;
    create: (data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    }) => Promise<import("./lib/types").Session>;
    update: (
      id: string,
      data: {
        title?: string;
        providerId?: string;
        modelId?: string;
        projectDir?: string;
        previewUrl?: string;
      },
    ) => Promise<import("./lib/types").Session>;
    delete: (id: string) => Promise<{ ok: boolean }>;
    getMessages: (sessionId: string) => Promise<import("./lib/types").Message[]>;
  };
  chat: {
    stream: (params: {
      sessionId: string;
      prompt: string;
      providerId: string;
      modelId: string;
      projectDir?: string;
      images?: string[];
      mode?: string;
    }) => Promise<void>;
    stop: (sessionId: string) => Promise<{ ok: boolean }>;
    onEvent: (
      callback: (data: {
        sessionId: string;
        event: import("./lib/types").SSEEvent;
      }) => void,
    ) => () => void;
  };
  fs: {
    listDirs: (path?: string) => Promise<{
      current: string;
      parent: string | null;
      dirs: string[];
    }>;
    listTree: (path: string) => Promise<{
      entries: Array<{ name: string; type: "file" | "dir" }>;
    }>;
    readFile: (path: string) => Promise<
      { content: string; language: string } | { binary: true; size: number }
    >;
    writeFile: (path: string, content: string) => Promise<{ ok: boolean }>;
    createEntry: (path: string, type: "file" | "dir") => Promise<{ ok: boolean }>;
    deleteEntry: (path: string) => Promise<{ ok: boolean }>;
    upload: (dirPath: string, fileName: string, data: ArrayBuffer) => Promise<{
      ok: boolean;
      name: string;
    }>;
  };
  git: {
    status: (dir: string) => Promise<{
      isGitRepo: boolean;
      branch?: string;
      changes?: Array<{
        status: string;
        file: string;
        index: string;
        workTree: string;
      }>;
      ahead?: number;
      behind?: number;
      isMerging?: boolean;
      directory?: string;
      error?: string;
    }>;
    branches: (dir: string) => Promise<{
      branches: Array<{
        name: string;
        isCurrent: boolean;
        isRemote: boolean;
        fullRef: string;
      }>;
      currentBranch: string;
    }>;
    checkout: (dir: string, branch: string) => Promise<{ ok: boolean; branch: string }>;
    createBranch: (dir: string, branch: string) => Promise<{ ok: boolean; branch: string }>;
    deleteBranch: (
      dir: string,
      branch: string,
      force?: boolean,
    ) => Promise<{ ok: boolean; branch: string }>;
    merge: (dir: string, branch: string) => Promise<{
      ok: boolean;
      merged?: boolean;
      hasConflicts?: boolean;
      error?: string;
    }>;
    conflicts: (dir: string) => Promise<{
      conflicts: Array<{ file: string; type: string }>;
    }>;
    diff: (dir: string, file?: string) => Promise<{ diff: string }>;
    stage: (dir: string, files: string[]) => Promise<{ ok: boolean }>;
    unstage: (dir: string, files: string[]) => Promise<{ ok: boolean }>;
    commit: (dir: string, message: string) => Promise<{ ok: boolean }>;
    push: (dir: string) => Promise<{ ok: boolean }>;
    pull: (dir: string) => Promise<{ ok: boolean }>;
    discard: (dir: string, files: string[]) => Promise<{ ok: boolean }>;
  };
  pty: {
    create: (opts?: {
      cwd?: string;
      command?: string;
      title?: string;
    }) => Promise<{
      id: string;
      title: string;
      command: string;
      cwd: string;
      status: string;
      pid: number;
    }>;
    write: (id: string, data: string) => Promise<void>;
    resize: (id: string, cols: number, rows: number) => Promise<{ ok: boolean }>;
    kill: (id: string) => Promise<{ ok: boolean }>;
    list: () => Promise<Array<{ id: string; title: string; status: string }>>;
    onData: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; exitCode: number }) => void) => () => void;
  };
  providers: {
    list: () => Promise<import("./lib/api").Provider[]>;
    models: (providerName: string) => Promise<import("./lib/api").ModelsResponse>;
    connectedModels: () => Promise<import("./lib/api").ConnectedModelsItem[]>;
    freeModels: () => Promise<import("./lib/api").FreeModel[]>;
    config: () => Promise<import("./lib/api").ModelsConfig>;
    upsert: (id: string, data: { apiKey: string }) => Promise<import("./lib/api").Provider>;
    delete: (id: string) => Promise<{ ok: boolean }>;
  };
  config: {
    getCwd: () => Promise<{ cwd: string | null }>;
    getActiveProvider: () => Promise<string | null>;
    setActiveProvider: (value: string) => Promise<{ ok: boolean }>;
  };
  actions: {
    getConfig: (dir: string) => Promise<{
      ok: boolean;
      actions: Array<{ label: string; script: string }>;
      name?: string;
    }>;
    run: (dir: string, script: string) => Promise<{
      ok: boolean;
      output?: string;
      error?: string;
    }>;
  };
  captureArea: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => Promise<string | null>;
  preview: {
    onAction: (
      callback: (data: {
        requestId: string;
        action: string;
        [key: string]: unknown;
      }) => void,
    ) => () => void;
    sendResult: (requestId: string, result: unknown) => void;
  };
  skills: {
    list: () => Promise<import("./lib/types").SkillInfo[]>;
    create: (
      name: string,
      description: string,
      content: string,
    ) => Promise<import("./lib/types").SkillInfo>;
    createRaw: (slug: string, raw: string) => Promise<{ ok: boolean }>;
    delete: (name: string) => Promise<{ ok: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
