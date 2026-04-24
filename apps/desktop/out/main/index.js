"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const fs = require("fs");
const sqliteCore = require("drizzle-orm/sqlite-core");
const drizzleOrm = require("drizzle-orm");
const ai = require("ai");
const anthropic = require("@ai-sdk/anthropic");
const openai = require("@ai-sdk/openai");
const google = require("@ai-sdk/google");
const openaiCompatible = require("@ai-sdk/openai-compatible");
const promises = require("fs/promises");
const url = require("url");
const v4 = require("zod/v4");
const node_path = require("node:path");
const promises$1 = require("node:fs/promises");
const fg = require("fast-glob");
const node_os = require("node:os");
const node_crypto = require("node:crypto");
const node_child_process = require("node:child_process");
const node_fs = require("node:fs");
const os = require("os");
function cuid() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rand}`;
}
const sessions$1 = sqliteCore.sqliteTable("sessions", {
  id: sqliteCore.text("id").primaryKey().$defaultFn(cuid),
  title: sqliteCore.text("title").notNull(),
  providerId: sqliteCore.text("provider_id"),
  modelId: sqliteCore.text("model_id"),
  projectDir: sqliteCore.text("project_dir"),
  previewUrl: sqliteCore.text("preview_url"),
  createdAt: sqliteCore.integer("created_at", { mode: "timestamp" }).notNull().default(drizzleOrm.sql`(unixepoch())`),
  updatedAt: sqliteCore.integer("updated_at", { mode: "timestamp" }).notNull().default(drizzleOrm.sql`(unixepoch())`)
});
const messages = sqliteCore.sqliteTable("messages", {
  id: sqliteCore.text("id").primaryKey().$defaultFn(cuid),
  sessionId: sqliteCore.text("session_id").notNull().references(() => sessions$1.id, { onDelete: "cascade" }),
  role: sqliteCore.text("role").notNull(),
  content: sqliteCore.text("content").notNull(),
  images: sqliteCore.text("images"),
  createdAt: sqliteCore.integer("created_at", { mode: "timestamp" }).notNull().default(drizzleOrm.sql`(unixepoch())`)
});
const providers = sqliteCore.sqliteTable("providers", {
  id: sqliteCore.text("id").primaryKey(),
  apiKey: sqliteCore.text("api_key").notNull(),
  modelId: sqliteCore.text("model_id").notNull(),
  createdAt: sqliteCore.integer("created_at", { mode: "timestamp" }).notNull().default(drizzleOrm.sql`(unixepoch())`),
  updatedAt: sqliteCore.integer("updated_at", { mode: "timestamp" }).notNull().default(drizzleOrm.sql`(unixepoch())`)
});
const config = sqliteCore.sqliteTable("config", {
  key: sqliteCore.text("key").primaryKey(),
  value: sqliteCore.text("value").notNull(),
  updatedAt: sqliteCore.integer("updated_at", { mode: "timestamp" }).notNull().default(drizzleOrm.sql`(unixepoch())`)
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  config,
  messages,
  providers,
  sessions: sessions$1
}, Symbol.toStringTag, { value: "Module" }));
let _db = null;
function getDb() {
  if (_db) return _db;
  const userDataPath = electron.app.getPath("userData");
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  const dbPath = path.join(userDataPath, "coodeen.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _db = betterSqlite3.drizzle(sqlite, { schema });
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      provider_id TEXT,
      model_id TEXT,
      project_dir TEXT,
      preview_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      images TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      api_key TEXT NOT NULL,
      model_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
  return _db;
}
const sessionDb = {
  create(data) {
    const db = getDb();
    const result = db.insert(sessions$1).values({
      title: data.title,
      providerId: data.providerId ?? null,
      modelId: data.modelId ?? null,
      projectDir: data.projectDir ?? null,
      previewUrl: data.previewUrl ?? null
    }).returning().get();
    return result;
  },
  get(id) {
    const db = getDb();
    return db.select().from(sessions$1).where(drizzleOrm.eq(sessions$1.id, id)).get();
  },
  list() {
    const db = getDb();
    return db.select().from(sessions$1).orderBy(drizzleOrm.desc(sessions$1.updatedAt)).all();
  },
  update(id, data) {
    const db = getDb();
    const updateData = {
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (data.title !== void 0) updateData.title = data.title;
    if (data.providerId !== void 0) updateData.providerId = data.providerId;
    if (data.modelId !== void 0) updateData.modelId = data.modelId;
    if (data.projectDir !== void 0) updateData.projectDir = data.projectDir;
    if (data.previewUrl !== void 0) updateData.previewUrl = data.previewUrl;
    return db.update(sessions$1).set(updateData).where(drizzleOrm.eq(sessions$1.id, id)).returning().get();
  },
  delete(id) {
    const db = getDb();
    db.delete(sessions$1).where(drizzleOrm.eq(sessions$1.id, id)).run();
  }
};
const messageDb = {
  append(sessionId, role, content, images) {
    const db = getDb();
    return db.insert(messages).values({
      sessionId,
      role,
      content,
      images: images?.length ? JSON.stringify(images) : null
    }).returning().get();
  },
  listBySession(sessionId) {
    const db = getDb();
    return db.select().from(messages).where(drizzleOrm.eq(messages.sessionId, sessionId)).orderBy(drizzleOrm.asc(messages.createdAt)).all();
  }
};
function registerSessionHandlers() {
  electron.ipcMain.handle("sessions:list", () => {
    return sessionDb.list();
  });
  electron.ipcMain.handle("sessions:get", (_e, id) => {
    return sessionDb.get(id);
  });
  electron.ipcMain.handle(
    "sessions:create",
    (_e, data) => {
      return sessionDb.create({
        title: data.title ?? "New Session",
        providerId: data.providerId,
        modelId: data.modelId,
        projectDir: data.projectDir,
        previewUrl: data.previewUrl
      });
    }
  );
  electron.ipcMain.handle(
    "sessions:update",
    (_e, id, data) => {
      return sessionDb.update(id, data);
    }
  );
  electron.ipcMain.handle("sessions:delete", (_e, id) => {
    sessionDb.delete(id);
    return { ok: true };
  });
  electron.ipcMain.handle("sessions:getMessages", (_e, sessionId) => {
    return messageDb.listBySession(sessionId);
  });
}
const providerDb = {
  list() {
    const db = getDb();
    return db.select().from(providers).orderBy(drizzleOrm.desc(providers.createdAt)).all();
  },
  get(id) {
    const db = getDb();
    return db.select().from(providers).where(drizzleOrm.eq(providers.id, id)).get();
  },
  upsert(id, data) {
    const db = getDb();
    const existing = db.select().from(providers).where(drizzleOrm.eq(providers.id, id)).get();
    if (existing) {
      return db.update(providers).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(drizzleOrm.eq(providers.id, id)).returning().get();
    }
    return db.insert(providers).values({ id, ...data }).returning().get();
  },
  delete(id) {
    const db = getDb();
    db.delete(providers).where(drizzleOrm.eq(providers.id, id)).run();
  }
};
const __dirname$1 = path.dirname(url.fileURLToPath(require("url").pathToFileURL(__filename).href));
const LOCAL_PATH = path.resolve(__dirname$1, "../../../../models.json");
const RAW_URL = "https://raw.githubusercontent.com/zahinafsar/coodeen/main/models.json";
const CACHE_TTL_MS = 5 * 60 * 1e3;
let cached = null;
let cachedAt = 0;
async function readLocal() {
  try {
    const text = await promises.readFile(LOCAL_PATH, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}
async function fetchRemote() {
  try {
    const res = await fetch(RAW_URL, {
      signal: AbortSignal.timeout(1e4),
      headers: { "Cache-Control": "no-cache" }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function getModelsConfig() {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }
  const raw = await readLocal() ?? await fetchRemote();
  if (raw) {
    cached = raw;
    cachedAt = Date.now();
    return cached;
  }
  if (cached) return cached;
  throw new Error("Failed to load models config from local file or GitHub");
}
async function getFreeModels() {
  const config2 = await getModelsConfig();
  return config2.free.models;
}
async function modelSupportsImage(providerId, modelId) {
  const config2 = await getModelsConfig();
  if (providerId === config2.free.provider) {
    const entry2 = config2.free.models.find((m) => m.id === modelId);
    return entry2?.input?.includes("image") ?? false;
  }
  const provider = config2.providers[providerId];
  if (!provider) return false;
  const entry = provider.models.find((m) => m.id === modelId);
  return entry?.input?.includes("image") ?? false;
}
async function resolveProvider(providerId, modelId) {
  if (providerId === "opencode") {
    const config2 = await getModelsConfig();
    const zen = openaiCompatible.createOpenAICompatible({
      name: config2.free.provider,
      baseURL: config2.free.baseURL,
      apiKey: "public"
    });
    const model2 = zen.chatModel(modelId);
    return { model: model2, providerId, modelId };
  }
  const providerRow = providerDb.get(providerId);
  if (!providerRow) {
    return {
      error: `Provider '${providerId}' not configured. Go to Settings.`
    };
  }
  if (!providerRow.apiKey) {
    return {
      error: `API key not configured for ${providerId}. Go to Settings.`
    };
  }
  const { apiKey } = providerRow;
  let model;
  switch (providerId) {
    case "anthropic": {
      const anthropic$1 = anthropic.createAnthropic({ apiKey });
      model = anthropic$1(modelId);
      break;
    }
    case "openai": {
      const openai$1 = openai.createOpenAI({ apiKey });
      model = openai$1(modelId);
      break;
    }
    case "google": {
      const google$1 = google.createGoogleGenerativeAI({ apiKey });
      model = google$1(modelId);
      break;
    }
    default:
      return { error: `Unsupported provider: ${providerId}` };
  }
  return { model, providerId, modelId };
}
function isResolveError(result) {
  return "error" in result;
}
const MAX_LINES = 2e3;
const MAX_BYTES = 50 * 1024;
function truncateOutput(text) {
  const lines = text.split("\n");
  const totalBytes = Buffer.byteLength(text, "utf-8");
  if (lines.length <= MAX_LINES && totalBytes <= MAX_BYTES) {
    return text;
  }
  const out = [];
  let bytes = 0;
  for (let i = 0; i < lines.length && i < MAX_LINES; i++) {
    const size = Buffer.byteLength(lines[i], "utf-8") + (i > 0 ? 1 : 0);
    if (bytes + size > MAX_BYTES) break;
    out.push(lines[i]);
    bytes += size;
  }
  const removedLines = lines.length - out.length;
  const removedBytes = totalBytes - bytes;
  return out.join("\n") + `

...${removedLines} lines / ${removedBytes} bytes truncated...
Use read with offset/limit to view specific sections, or grep to search the full content.`;
}
const createReadTool = (projectDir) => ai.tool({
  description: "Read a file from the local filesystem. The filePath parameter should be an absolute path. By default, returns up to 2000 lines from the start of the file. Use the offset parameter (1-indexed) to start from a later line. Use the grep tool to find specific content in large files. If unsure of the correct file path, use the glob tool to look up filenames. Contents are returned with each line prefixed by its line number. Any line longer than 2000 characters is truncated. Call this tool in parallel when you know there are multiple files you want to read. Avoid tiny repeated slices (30 line chunks). If you need more context, read a larger window.",
  inputSchema: v4.z.object({
    file_path: v4.z.string().describe("Absolute or project-relative path to the file to read"),
    offset: v4.z.number().optional().describe("1-based line number to start reading from (default: 1)"),
    limit: v4.z.number().optional().describe("Maximum number of lines to return (default: 2000)")
  }),
  execute: async ({ file_path, offset, limit }) => {
    try {
      const resolved = node_path.resolve(projectDir, file_path);
      const raw = await promises$1.readFile(resolved, "utf-8");
      let lines = raw.split("\n");
      const start = (offset ?? 1) - 1;
      if (start > 0) lines = lines.slice(start);
      const maxLines = limit ?? 2e3;
      const truncated = lines.length > maxLines;
      if (truncated) lines = lines.slice(0, maxLines);
      lines = lines.map((line) => line.length > 2e3 ? line.substring(0, 2e3) + "..." : line);
      const numbered = lines.map((line, i) => `${start + i + 1}: ${line}`).join("\n");
      let result = numbered;
      if (truncated) {
        result += `

[Showing ${maxLines} of ${raw.split("\n").length} lines. Use offset=${start + maxLines + 1} to read more.]`;
      }
      return truncateOutput(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error reading file: ${message}]`;
    }
  }
});
const createWriteTool = (projectDir) => ai.tool({
  description: "Writes a file to the local filesystem. This tool will overwrite the existing file if there is one at the provided path. If this is an existing file, you MUST use the read tool first to read the file's contents. ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required. NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the user.",
  inputSchema: v4.z.object({
    file_path: v4.z.string().describe("Absolute or project-relative path to write to"),
    content: v4.z.string().describe("The full content to write to the file")
  }),
  execute: async ({ file_path, content }) => {
    try {
      const resolved = node_path.resolve(projectDir, file_path);
      await promises$1.mkdir(node_path.dirname(resolved), { recursive: true });
      await promises$1.writeFile(resolved, content, "utf-8");
      return `Wrote ${content.split("\n").length} lines to ${file_path}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error writing file: ${message}]`;
    }
  }
});
const createEditTool = (projectDir) => ai.tool({
  description: "Performs exact string replacements in files. You must use the read tool at least once before editing a file. When editing text from read tool output, preserve the exact indentation (tabs/spaces) as it appears AFTER the line number prefix. The line number prefix format is: line number + colon + space. Everything after that space is the actual file content to match. ALWAYS prefer editing existing files. NEVER write new files unless explicitly required. The edit will FAIL if old_string is not found in the file. The edit will FAIL if old_string is found multiple times — provide more surrounding context to make it unique, or use replace_all. Use replace_all for replacing and renaming strings across the file.",
  inputSchema: v4.z.object({
    file_path: v4.z.string().describe("Absolute or project-relative path to the file to edit"),
    old_string: v4.z.string().describe("The exact text to find (must match file content exactly, including whitespace and indentation)"),
    new_string: v4.z.string().describe("The replacement text (must be different from old_string)"),
    replace_all: v4.z.boolean().optional().describe("Replace all occurrences of old_string (default: false)")
  }),
  execute: async ({ file_path, old_string, new_string, replace_all }) => {
    try {
      const resolved = node_path.resolve(projectDir, file_path);
      const content = await promises$1.readFile(resolved, "utf-8");
      if (old_string === new_string) {
        return `[Error: old_string and new_string are identical]`;
      }
      const occurrences = content.split(old_string).length - 1;
      if (occurrences === 0) {
        return `[Error: old_string not found in ${file_path}. Make sure it matches the file content exactly, including whitespace and indentation.]`;
      }
      if (occurrences > 1 && !replace_all) {
        return `[Error: Found ${occurrences} matches for old_string. Provide more surrounding lines to identify the correct match, or use replace_all to change every instance.]`;
      }
      const updated = replace_all ? content.replaceAll(old_string, new_string) : content.replace(old_string, new_string);
      await promises$1.writeFile(resolved, updated, "utf-8");
      const count = replace_all ? occurrences : 1;
      return `Edited ${file_path}: replaced ${count} occurrence${count > 1 ? "s" : ""}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error editing file: ${message}]`;
    }
  }
});
const createMultiEditTool = (projectDir) => ai.tool({
  description: "Make multiple edits to a single file in one operation. Prefer this over the edit tool when you need to make multiple changes to the same file. Edits are applied sequentially — each edit operates on the result of the previous one. All edits must be valid or none are applied (atomic).",
  inputSchema: v4.z.object({
    file_path: v4.z.string().describe("Absolute or project-relative path to the file to edit"),
    edits: v4.z.array(
      v4.z.object({
        old_string: v4.z.string().describe(
          "The exact text to find (must match file content exactly, including whitespace)"
        ),
        new_string: v4.z.string().describe("The replacement text (must differ from old_string)"),
        replace_all: v4.z.boolean().optional().describe("Replace all occurrences of old_string (default: false)")
      })
    ).min(1).describe("Array of edit operations to apply sequentially")
  }),
  execute: async ({ file_path, edits }) => {
    try {
      const resolved = node_path.resolve(projectDir, file_path);
      let content = await promises$1.readFile(resolved, "utf-8");
      let dryContent = content;
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        if (edit.old_string === edit.new_string) {
          return `[Error: edit ${i + 1} — old_string and new_string are identical]`;
        }
        const occurrences = dryContent.split(edit.old_string).length - 1;
        if (occurrences === 0) {
          return `[Error: edit ${i + 1} — old_string not found in ${file_path}. Earlier edits may have changed the content. Verify each edit against the result of the previous one.]`;
        }
        if (occurrences > 1 && !edit.replace_all) {
          return `[Error: edit ${i + 1} — old_string found ${occurrences} times. Use replace_all: true or provide more context to make it unique.]`;
        }
        if (edit.replace_all) {
          dryContent = dryContent.replaceAll(edit.old_string, edit.new_string);
        } else {
          dryContent = dryContent.replace(edit.old_string, edit.new_string);
        }
      }
      for (const edit of edits) {
        if (edit.replace_all) {
          content = content.replaceAll(edit.old_string, edit.new_string);
        } else {
          content = content.replace(edit.old_string, edit.new_string);
        }
      }
      await promises$1.writeFile(resolved, content, "utf-8");
      return `Applied ${edits.length} edits to ${file_path}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error editing file: ${message}]`;
    }
  }
});
const createGlobTool = (projectDir) => ai.tool({
  description: 'Fast file pattern matching tool that works with any codebase size. Supports glob patterns like "**/*.js" or "src/**/*.ts". Returns matching file paths sorted by modification time. Use this tool when you need to find files by name patterns. It is always better to speculatively perform multiple searches in parallel if they are potentially useful.',
  inputSchema: v4.z.object({
    pattern: v4.z.string().describe('Glob pattern to match files (e.g. "**/*.ts", "src/**/*.tsx")')
  }),
  execute: async ({ pattern }) => {
    try {
      const absProjectDir = node_path.resolve(projectDir);
      const matches = await fg(pattern, {
        cwd: absProjectDir,
        dot: false,
        onlyFiles: true,
        ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
        stats: true
      });
      matches.sort((a, b) => (b.stats?.mtimeMs ?? 0) - (a.stats?.mtimeMs ?? 0));
      const relativePaths = matches.map((m) => node_path.relative(absProjectDir, node_path.resolve(absProjectDir, m.path)));
      if (relativePaths.length === 0) return "No files matched the pattern.";
      return truncateOutput(relativePaths.join("\n"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error globbing pattern: ${message}]`;
    }
  }
});
const createGrepTool = (projectDir) => ai.tool({
  description: 'Fast content search tool that works with any codebase size. Searches file contents using regular expressions. Supports full regex syntax (eg. "log.*Error", "function\\s+\\w+"). Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}"). Returns file paths and line numbers with at least one match. Use this tool when you need to find files containing specific patterns.',
  inputSchema: v4.z.object({
    pattern: v4.z.string().describe("Regular expression pattern to search for"),
    path: v4.z.string().optional().describe("File or directory to search in (default: entire project)"),
    include: v4.z.string().optional().describe('Glob pattern to filter files (eg. "*.ts", "*.{js,jsx}")')
  }),
  execute: async ({ pattern, path: path2, include }) => {
    try {
      const absProjectDir = node_path.resolve(projectDir);
      const searchRoot = path2 ? node_path.resolve(absProjectDir, path2) : absProjectDir;
      let regex;
      try {
        regex = new RegExp(pattern);
      } catch {
        return `[Error: Invalid regex pattern: ${pattern}]`;
      }
      let isFile = false;
      try {
        const s = await promises$1.stat(searchRoot);
        isFile = s.isFile();
      } catch {
      }
      let files;
      if (isFile) {
        files = [searchRoot];
      } else {
        const globPattern = include || "**/*";
        files = await fg(globPattern, {
          cwd: searchRoot,
          dot: false,
          onlyFiles: true,
          ignore: [
            "**/node_modules/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
            "**/*.png",
            "**/*.jpg",
            "**/*.gif",
            "**/*.ico",
            "**/*.woff",
            "**/*.woff2",
            "**/*.ttf",
            "**/*.eot",
            "**/*.mp4",
            "**/*.webm",
            "**/*.zip",
            "**/*.tar",
            "**/*.gz"
          ]
        });
        files = files.map((f) => node_path.resolve(searchRoot, f));
      }
      const matchesByFile = /* @__PURE__ */ new Map();
      let totalMatches = 0;
      for (const filePath of files) {
        try {
          const content = await promises$1.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const relPath = node_path.relative(absProjectDir, filePath);
              if (!matchesByFile.has(relPath)) matchesByFile.set(relPath, []);
              matchesByFile.get(relPath).push({
                line: i + 1,
                content: lines[i].trim()
              });
              totalMatches++;
            }
          }
        } catch {
        }
      }
      if (totalMatches === 0) {
        return "No matches found.";
      }
      const outputLines = [`Found ${totalMatches} matches`];
      for (const [filePath, matches] of matchesByFile) {
        outputLines.push("");
        outputLines.push(`${filePath}:`);
        for (const m of matches) {
          outputLines.push(`  Line ${m.line}: ${m.content}`);
        }
      }
      return truncateOutput(outputLines.join("\n"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error searching files: ${message}]`;
    }
  }
});
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/target/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/.idea/**",
  "**/.vscode/**",
  "**/coverage/**",
  "**/.cache/**",
  "**/tmp/**",
  "**/temp/**",
  "**/logs/**",
  "**/.next/**",
  "**/.turbo/**"
];
const FILE_LIMIT = 100;
const createLsTool = (projectDir) => ai.tool({
  description: "List files and directories in a tree view. Ignores common noise directories (node_modules, .git, dist, etc). Limited to 100 files. Use glob or grep for targeted searches.",
  inputSchema: v4.z.object({
    path: v4.z.string().optional().describe(
      "Absolute or project-relative directory path (default: project root)"
    )
  }),
  execute: async ({ path: path2 }) => {
    try {
      let renderDir = function(dirPath, depth) {
        const indent = "  ".repeat(depth);
        let output2 = "";
        if (depth > 0) {
          output2 += `${indent}${node_path.basename(dirPath)}/
`;
        }
        const childIndent = "  ".repeat(depth + 1);
        const children = Array.from(dirs).filter((d) => node_path.dirname(d) === dirPath && d !== dirPath).sort();
        for (const child of children) {
          output2 += renderDir(child, depth + 1);
        }
        const dirFiles = filesByDir.get(dirPath) || [];
        for (const f of dirFiles.sort()) {
          output2 += `${childIndent}${f}
`;
        }
        return output2;
      };
      const searchPath = node_path.resolve(projectDir, path2 || ".");
      const matches = await fg("**/*", {
        cwd: searchPath,
        dot: false,
        onlyFiles: true,
        ignore: IGNORE_PATTERNS
      });
      const files = matches.slice(0, FILE_LIMIT).sort();
      if (files.length === 0) {
        return `${searchPath}/
  (empty)`;
      }
      const dirs = /* @__PURE__ */ new Set();
      const filesByDir = /* @__PURE__ */ new Map();
      for (const file of files) {
        const dir = node_path.dirname(file);
        const parts = dir === "." ? [] : dir.split("/");
        for (let i = 0; i <= parts.length; i++) {
          const dirPath = i === 0 ? "." : parts.slice(0, i).join("/");
          dirs.add(dirPath);
        }
        if (!filesByDir.has(dir)) filesByDir.set(dir, []);
        filesByDir.get(dir).push(node_path.basename(file));
      }
      const relPath = node_path.relative(projectDir, searchPath) || ".";
      let output = `${relPath}/
${renderDir(".", 0)}`;
      if (matches.length > FILE_LIMIT) {
        output += `
(showing ${FILE_LIMIT} of ${matches.length} files — use glob for targeted search)`;
      }
      return truncateOutput(output);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error listing directory: ${message}]`;
    }
  }
});
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;
const MAX_TIMEOUT = 12e4;
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function htmlToMarkdown(html) {
  let md = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n").replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n").replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n").replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n").replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n").replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n").replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n").replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n").replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`").replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)").replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**").replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*").replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  return md;
}
const createWebFetchTool = () => ai.tool({
  description: "Fetch content from a URL and return it as markdown or plain text. Use this to read web pages, documentation, articles, or any URL. Returns cleaned content with HTML/JS/CSS removed.",
  inputSchema: v4.z.object({
    url: v4.z.string().describe("The URL to fetch content from"),
    format: v4.z.enum(["text", "markdown"]).optional().describe(
      "Output format: 'markdown' (default) preserves headings/links/code, 'text' is plain text"
    ),
    timeout: v4.z.number().optional().describe("Optional timeout in seconds (default: 30, max: 120)")
  }),
  execute: async ({ url: url2, format = "markdown", timeout }) => {
    if (!url2.startsWith("http://") && !url2.startsWith("https://")) {
      url2 = "https://" + url2;
    }
    const ms = Math.min((timeout ?? 30) * 1e3, MAX_TIMEOUT);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      try {
        const res = await fetch(url2, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
          },
          signal: controller.signal,
          redirect: "follow"
        });
        clearTimeout(timer);
        if (!res.ok) {
          return `[Error: Request failed with status ${res.status}]`;
        }
        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
          return `[Error: Response too large (exceeds 5MB limit)]`;
        }
        const html = await res.text();
        if (html.length > MAX_RESPONSE_SIZE) {
          return `[Error: Response too large (exceeds 5MB limit)]`;
        }
        const content = format === "text" ? htmlToText(html) : htmlToMarkdown(html);
        return `Content from ${url2}:

${content}`;
      } catch (error) {
        clearTimeout(timer);
        if (error instanceof Error && error.name === "AbortError") {
          return `[Error: Fetch timed out after ${ms / 1e3}s]`;
        }
        const message = error instanceof Error ? error.message : String(error);
        return `[Error fetching URL: ${message}]`;
      }
    } catch (error) {
      clearTimeout(timer);
      const message = error instanceof Error ? error.message : String(error);
      return `[Error: ${message}]`;
    }
  }
});
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const DEFAULT_TIMEOUT$1 = 3e4;
const MIME_TO_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg"
};
const createImageFetchTool = (supportsVision) => ai.tool({
  description: "Fetch an image from a URL, save it to a temp file, and return the file path. Use this when you need to download or inspect an image from a URL. Supports PNG, JPEG, GIF, WebP, SVG (max 20MB).",
  inputSchema: v4.z.object({
    url: v4.z.string().describe("The image URL to fetch")
  }),
  execute: async ({ url: url2 }) => {
    if (!url2.startsWith("http://") && !url2.startsWith("https://")) {
      url2 = "https://" + url2;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT$1);
    try {
      const res = await fetch(url2, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "image/*,*/*"
        },
        signal: controller.signal,
        redirect: "follow"
      });
      clearTimeout(timer);
      if (!res.ok) {
        return `[Error: Request failed with status ${res.status}]`;
      }
      const contentType = res.headers.get("content-type") || "";
      const mime = contentType.split(";")[0].trim();
      if (!mime.startsWith("image/")) {
        return `[Error: URL did not return an image (content-type: ${contentType})]`;
      }
      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
        return `[Error: Image too large (exceeds 20MB)]`;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > MAX_IMAGE_SIZE) {
        return `[Error: Image too large (exceeds 20MB)]`;
      }
      const ext = MIME_TO_EXT[mime] || ".bin";
      const dir = node_path.join(node_os.tmpdir(), "coodeen-images");
      await promises$1.mkdir(dir, { recursive: true });
      const filePath = node_path.join(dir, `${node_crypto.randomUUID()}${ext}`);
      await promises$1.writeFile(filePath, buffer);
      const sizeKB = Math.round(buffer.byteLength / 1024);
      return `Image saved to ${filePath} (${mime}, ${sizeKB}KB)`;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") {
        return `[Error: Image fetch timed out after ${DEFAULT_TIMEOUT$1 / 1e3}s]`;
      }
      return `[Error: ${error instanceof Error ? error.message : error}]`;
    }
  }
});
const GLOBAL_SKILLS_DIR = node_path.join(node_os.homedir(), ".coodeen", "skills");
function parseSkillMd(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = match[1];
  const content = match[2].trim();
  let name = "";
  let description = "";
  for (const line of frontmatter.split("\n")) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (!kv) continue;
    if (kv[1] === "name") name = kv[2].trim().replace(/^["']|["']$/g, "");
    if (kv[1] === "description") description = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!name) return null;
  return { name, description, content };
}
async function scanDir(root) {
  const skills = [];
  try {
    const entries = await promises$1.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = node_path.join(root, entry.name, "SKILL.md");
      try {
        const raw = await promises$1.readFile(skillMdPath, "utf-8");
        const parsed = parseSkillMd(raw);
        if (parsed) {
          skills.push({
            name: parsed.name,
            description: parsed.description,
            location: skillMdPath,
            content: parsed.content,
            enabled: true
          });
        }
      } catch {
      }
    }
  } catch {
  }
  return skills;
}
async function discoverSkills() {
  const all = [];
  const found = await scanDir(GLOBAL_SKILLS_DIR);
  for (const skill of found) {
    const idx = all.findIndex((s) => s.name === skill.name);
    if (idx >= 0) all[idx] = skill;
    else all.push(skill);
  }
  return all;
}
async function getSkill(name) {
  const skills = await discoverSkills();
  return skills.find((s) => s.name === name) ?? null;
}
async function createSkill(name, description, content) {
  const dir = node_path.join(GLOBAL_SKILLS_DIR, name);
  await promises$1.mkdir(dir, { recursive: true });
  const skillMd = `---
name: ${name}
description: ${description}
---

${content}
`;
  const location = node_path.join(dir, "SKILL.md");
  await promises$1.writeFile(location, skillMd, "utf-8");
  return { name, description, location, content, enabled: true };
}
async function createSkillRaw(slug, raw) {
  const dir = node_path.join(GLOBAL_SKILLS_DIR, slug);
  await promises$1.mkdir(dir, { recursive: true });
  const location = node_path.join(dir, "SKILL.md");
  await promises$1.writeFile(location, raw, "utf-8");
}
async function deleteSkill(name) {
  const dir = node_path.join(GLOBAL_SKILLS_DIR, name);
  try {
    await promises$1.stat(dir);
    await promises$1.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
function createSkillTool() {
  return ai.tool({
    description: [
      "Load a specialized skill that provides domain-specific instructions and workflows.",
      "When you recognize that a task matches one of the available skills, use this tool to load the full skill instructions.",
      "The skill will inject detailed instructions, workflows, and references into the conversation context."
    ].join("\n"),
    inputSchema: v4.z.object({
      name: v4.z.string().describe("The name of the skill to load")
    }),
    execute: async ({ name }) => {
      const skill = await getSkill(name);
      if (!skill) {
        const all = await discoverSkills();
        const available = all.map((s) => s.name).join(", ");
        return `Skill "${name}" not found. Available skills: ${available || "none"}`;
      }
      return [
        `<skill_content name="${skill.name}">`,
        `# Skill: ${skill.name}`,
        "",
        skill.content,
        "",
        `</skill_content>`
      ].join("\n");
    }
  });
}
const DEFAULT_TIMEOUT = 2 * 60 * 1e3;
const MAX_OUTPUT_BYTES = 100 * 1024;
const createBashTool = (projectDir) => ai.tool({
  description: "Executes a given bash command with optional timeout. IMPORTANT: This tool is for terminal operations like git, npm, docker, etc. DO NOT use it for file operations (reading, writing, editing, searching, finding files) — use the specialized tools instead. Use the workdir parameter to run in a different directory. AVOID using 'cd <directory> && <command>' patterns. Avoid using bash with find, grep, cat, head, tail, sed, awk, or echo — use the dedicated tools instead: glob (not find), grep tool (not grep/rg), read (not cat/head/tail), edit (not sed/awk), write (not echo). When issuing multiple independent commands, make multiple bash tool calls in parallel. If commands depend on each other, chain them with && in a single call.",
  inputSchema: v4.z.object({
    command: v4.z.string().describe("The shell command to execute"),
    workdir: v4.z.string().optional().describe("Working directory. Defaults to the project directory."),
    timeout: v4.z.number().optional().describe("Timeout in milliseconds (default: 120000). Set to 0 for no timeout."),
    description: v4.z.string().describe("Clear, concise description of what this command does (5-10 words)")
  }),
  execute: async ({ command, workdir, timeout }) => {
    const cwd = workdir ? node_path.resolve(projectDir, workdir) : projectDir;
    const timeoutMs = timeout ?? DEFAULT_TIMEOUT;
    try {
      return await new Promise((resolve2) => {
        let output = "";
        let timedOut = false;
        const proc = node_child_process.spawn(command, {
          shell: true,
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env }
        });
        const handleData = (chunk) => {
          const text = chunk.toString();
          output += text;
          if (output.length > MAX_OUTPUT_BYTES) {
            output = output.substring(0, MAX_OUTPUT_BYTES) + "\n\n[Output truncated — exceeded 100 KB limit]";
            proc.kill();
          }
        };
        proc.stdout?.on("data", handleData);
        proc.stderr?.on("data", handleData);
        let timeoutHandle = null;
        if (timeoutMs > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            proc.kill("SIGTERM");
          }, timeoutMs);
        }
        proc.once("exit", (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (timedOut) {
            output += `

[Command timed out after ${timeoutMs} ms]`;
          }
          if (code !== 0 && code !== null) {
            output += `

[Exit code: ${code}]`;
          }
          resolve2(truncateOutput(output.trim() || "[No output]"));
        });
        proc.once("error", (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          output += `

[Process error: ${error.message}]`;
          resolve2(truncateOutput(output.trim() || "[No output]"));
        });
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `[Error executing command: ${errorMsg}]`;
    }
  }
});
const sessionTodos = /* @__PURE__ */ new Map();
const createTodoWriteTool = (sessionId) => ai.tool({
  description: "Create and manage a task list for the current session. Use proactively for complex multi-step tasks (3+ steps). Helps track progress and shows the user what you're working on. Skip for single, trivial tasks.",
  inputSchema: v4.z.object({
    todos: v4.z.array(
      v4.z.object({
        content: v4.z.string().describe("Task description"),
        status: v4.z.enum(["pending", "in_progress", "completed"]).describe("Task status")
      })
    ).describe("The full updated todo list")
  }),
  execute: async ({ todos }) => {
    sessionTodos.set(sessionId, todos);
    const pending = todos.filter((t) => t.status === "pending").length;
    const inProgress = todos.filter((t) => t.status === "in_progress").length;
    const completed = todos.filter((t) => t.status === "completed").length;
    return `Todo list updated: ${completed} done, ${inProgress} in progress, ${pending} pending`;
  }
});
const createTodoReadTool = (sessionId) => ai.tool({
  description: "Read the current task list for this session. Use to check progress, plan next steps, or review remaining work.",
  inputSchema: v4.z.object({}),
  execute: async () => {
    const todos = sessionTodos.get(sessionId) || [];
    if (todos.length === 0) return "No todos yet.";
    return todos.map((t, i) => `${i + 1}. [${t.status}] ${t.content}`).join("\n");
  }
});
const sessionImages = /* @__PURE__ */ new Map();
const createImageSaveTool = (projectDir, sessionId) => ai.tool({
  description: "Save an image from the current conversation to a file. Use this when the user drops/pastes an image and asks you to save, use, or place it in the project. The image_index refers to the order of images attached to the user's message (0-based). Supports common formats: png, jpg, gif, webp, svg.",
  inputSchema: v4.z.object({
    image_index: v4.z.number().describe("Index of the image from the user's message (0-based, first image = 0)"),
    file_path: v4.z.string().describe("Project-relative or absolute path to save the image to (e.g. 'public/logo.png')")
  }),
  execute: async ({ image_index, file_path }) => {
    try {
      const images = sessionImages.get(sessionId);
      if (!images || images.length === 0) {
        return `[Error: No images attached to the current message]`;
      }
      if (image_index < 0 || image_index >= images.length) {
        return `[Error: Invalid image_index ${image_index}. ${images.length} image(s) available (0-${images.length - 1})]`;
      }
      const dataUrl = images[image_index];
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return `[Error: Image is not in base64 data URL format]`;
      }
      const buffer = Buffer.from(match[2], "base64");
      const resolved = node_path.resolve(projectDir, file_path);
      await promises$1.mkdir(node_path.dirname(resolved), { recursive: true });
      await promises$1.writeFile(resolved, buffer);
      const sizeKB = Math.round(buffer.length / 1024);
      return `Saved image (${sizeKB}KB) to ${file_path}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `[Error saving image: ${message}]`;
    }
  }
});
const SCREENSHOT_DIR = node_path.join(node_os.tmpdir(), "coodeen-screenshots");
const ACTION_TIMEOUT = 1e4;
function sendPreviewAction(getWindow2, payload) {
  return new Promise((resolve) => {
    const win = getWindow2();
    if (!win) {
      resolve({ success: false, error: "No window available" });
      return;
    }
    const requestId = node_crypto.randomUUID();
    const channel = `preview:action-result:${requestId}`;
    const timeout = setTimeout(() => {
      electron.ipcMain.removeAllListeners(channel);
      resolve({ success: false, error: "Preview action timed out — is the preview panel open?" });
    }, ACTION_TIMEOUT);
    electron.ipcMain.once(channel, (_e, result) => {
      clearTimeout(timeout);
      resolve(result);
    });
    win.webContents.send("preview:action", { requestId, ...payload });
  });
}
const createBrowserTool = (getWindow2, supportsVision) => ai.tool({
  description: "Interact with the preview iframe. Use 'screenshot' to capture the current state of the preview panel. Use 'scroll' to scroll the page up/down by pixels or to top/bottom. Use 'click' to click an element by CSS selector.",
  inputSchema: ai.zodSchema(
    v4.z.object({
      action: v4.z.enum(["screenshot", "scroll", "click"]).describe(
        "Action to perform: 'screenshot' captures the preview, 'scroll' scrolls the page, 'click' clicks an element"
      ),
      direction: v4.z.enum(["up", "down"]).optional().describe(
        "Scroll direction (required for scroll action)"
      ),
      amount: v4.z.union([
        v4.z.number().describe("Pixels to scroll"),
        v4.z.enum(["top", "bottom"]).describe("Scroll to absolute position")
      ]).optional().describe(
        "Scroll amount — pixels or 'top'/'bottom' (defaults to 500 for scroll action)"
      ),
      selector: v4.z.string().optional().describe(
        "CSS selector of the element to click (required for click action)"
      )
    })
  ),
  execute: async (rawInput) => {
    const input = {
      ...rawInput,
      amount: rawInput.amount ?? (rawInput.action === "scroll" ? 500 : void 0),
      direction: rawInput.direction ?? (rawInput.action === "scroll" ? "down" : void 0)
    };
    if (input.action === "screenshot") {
      const boundsResult = await sendPreviewAction(getWindow2, { action: "screenshot" });
      if (!boundsResult.success) {
        return { error: boundsResult.error ?? "Failed to get iframe bounds" };
      }
      const win = getWindow2();
      if (!win) return { error: "No window available" };
      const { x, y, width, height } = boundsResult.data;
      const image = await win.webContents.capturePage({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      });
      const pngBuffer = image.toPNG();
      await promises$1.mkdir(SCREENSHOT_DIR, { recursive: true });
      const fileName = `preview-${Date.now()}.png`;
      const filePath = node_path.join(SCREENSHOT_DIR, fileName);
      await promises$1.writeFile(filePath, pngBuffer);
      return { action: "screenshot", filePath };
    }
    const result = await sendPreviewAction(getWindow2, input);
    if (!result.success) {
      return { error: result.error ?? `${input.action} failed` };
    }
    return { action: input.action, success: true };
  },
  toModelOutput({ output }) {
    if ("error" in output) {
      return {
        type: "text",
        value: `[Browser tool error: ${output.error}]`
      };
    }
    if (output.action === "screenshot" && "filePath" in output) {
      const filePath = output.filePath;
      if (supportsVision) {
        try {
          const data = node_fs.readFileSync(filePath);
          const base64 = Buffer.from(data).toString("base64");
          return {
            type: "content",
            value: [
              {
                type: "image-data",
                data: base64,
                mediaType: "image/png"
              },
              {
                type: "text",
                text: `[File: ${filePath}]`
              }
            ]
          };
        } catch {
          return {
            type: "text",
            value: `Screenshot saved to ${filePath} but could not read it back.`
          };
        }
      }
      return {
        type: "text",
        value: `Screenshot saved to ${filePath}. This model does not support vision.`
      };
    }
    return {
      type: "text",
      value: `${output.action} completed successfully.`
    };
  }
});
function stripHeredoc(input) {
  const m = input.match(/^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/);
  return m ? m[2] : input;
}
function parsePatch(patchText) {
  const lines = stripHeredoc(patchText.trim()).split("\n");
  const beginIdx = lines.findIndex((l) => l.trim() === "*** Begin Patch");
  const endIdx = lines.findIndex((l) => l.trim() === "*** End Patch");
  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
    throw new Error("Invalid patch format: missing Begin/End markers");
  }
  const hunks = [];
  let i = beginIdx + 1;
  while (i < endIdx) {
    const line = lines[i];
    if (line.startsWith("*** Add File:")) {
      const filePath = line.slice("*** Add File:".length).trim();
      i++;
      let content = "";
      while (i < endIdx && !lines[i].startsWith("***")) {
        if (lines[i].startsWith("+")) content += lines[i].substring(1) + "\n";
        i++;
      }
      if (content.endsWith("\n")) content = content.slice(0, -1);
      hunks.push({ type: "add", path: filePath, contents: content });
    } else if (line.startsWith("*** Delete File:")) {
      hunks.push({ type: "delete", path: line.slice("*** Delete File:".length).trim() });
      i++;
    } else if (line.startsWith("*** Update File:")) {
      const filePath = line.slice("*** Update File:".length).trim();
      i++;
      let movePath;
      if (i < endIdx && lines[i].startsWith("*** Move to:")) {
        movePath = lines[i].slice("*** Move to:".length).trim();
        i++;
      }
      const chunks = [];
      while (i < endIdx && !lines[i].startsWith("***")) {
        if (lines[i].startsWith("@@")) {
          const changeContext = lines[i].substring(2).trim() || void 0;
          i++;
          const oldLines = [];
          const newLines = [];
          let isEndOfFile = false;
          while (i < endIdx && !lines[i].startsWith("@@") && !lines[i].startsWith("***")) {
            if (lines[i] === "*** End of File") {
              isEndOfFile = true;
              i++;
              break;
            }
            if (lines[i].startsWith(" ")) {
              const c = lines[i].substring(1);
              oldLines.push(c);
              newLines.push(c);
            } else if (lines[i].startsWith("-")) oldLines.push(lines[i].substring(1));
            else if (lines[i].startsWith("+")) newLines.push(lines[i].substring(1));
            i++;
          }
          chunks.push({ old_lines: oldLines, new_lines: newLines, change_context: changeContext, is_end_of_file: isEndOfFile || void 0 });
        } else {
          i++;
        }
      }
      hunks.push({ type: "update", path: filePath, move_path: movePath, chunks });
    } else {
      i++;
    }
  }
  return hunks;
}
function normalizeUnicode(s) {
  return s.replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/[\u2010-\u2015]/g, "-").replace(/\u2026/g, "...").replace(/\u00A0/g, " ");
}
function tryMatch(lines, pattern, start, cmp, eof) {
  if (eof) {
    const fromEnd = lines.length - pattern.length;
    if (fromEnd >= start && pattern.every((p, j) => cmp(lines[fromEnd + j], p))) return fromEnd;
  }
  for (let i = start; i <= lines.length - pattern.length; i++) {
    if (pattern.every((p, j) => cmp(lines[i + j], p))) return i;
  }
  return -1;
}
function seekSequence(lines, pattern, start, eof = false) {
  if (!pattern.length) return -1;
  let r = tryMatch(lines, pattern, start, (a, b) => a === b, eof);
  if (r !== -1) return r;
  r = tryMatch(lines, pattern, start, (a, b) => a.trimEnd() === b.trimEnd(), eof);
  if (r !== -1) return r;
  r = tryMatch(lines, pattern, start, (a, b) => a.trim() === b.trim(), eof);
  if (r !== -1) return r;
  return tryMatch(lines, pattern, start, (a, b) => normalizeUnicode(a.trim()) === normalizeUnicode(b.trim()), eof);
}
function deriveNewContents(filePath, chunks) {
  let lines = node_fs.readFileSync(filePath, "utf-8").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const replacements = [];
  let idx = 0;
  for (const chunk of chunks) {
    if (chunk.change_context) {
      const ci = seekSequence(lines, [chunk.change_context], idx);
      if (ci === -1) throw new Error(`Context '${chunk.change_context}' not found in ${filePath}`);
      idx = ci + 1;
    }
    if (chunk.old_lines.length === 0) {
      const ins = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
      replacements.push([ins, 0, chunk.new_lines]);
      continue;
    }
    let pattern = chunk.old_lines;
    let newSlice = chunk.new_lines;
    let found = seekSequence(lines, pattern, idx, chunk.is_end_of_file);
    if (found === -1 && pattern.length > 0 && pattern[pattern.length - 1] === "") {
      pattern = pattern.slice(0, -1);
      if (newSlice.length > 0 && newSlice[newSlice.length - 1] === "") newSlice = newSlice.slice(0, -1);
      found = seekSequence(lines, pattern, idx, chunk.is_end_of_file);
    }
    if (found === -1) throw new Error(`Failed to find expected lines in ${filePath}:
${chunk.old_lines.join("\n")}`);
    replacements.push([found, pattern.length, newSlice]);
    idx = found + pattern.length;
  }
  replacements.sort((a, b) => a[0] - b[0]);
  const result = [...lines];
  for (let i = replacements.length - 1; i >= 0; i--) {
    const [start, len, seg] = replacements[i];
    result.splice(start, len, ...seg);
  }
  if (result.length === 0 || result[result.length - 1] !== "") result.push("");
  return result.join("\n");
}
const DESCRIPTION$1 = 'Apply a patch to create, update, delete, or move files. The patch format uses *** Begin Patch / *** End Patch markers with file sections:\n*** Add File: <path> — new file, every line prefixed with +\n*** Delete File: <path> — remove a file\n*** Update File: <path> — edit in place with @@ context and +/- lines\n*** Move to: <path> — rename (after Update File header)\n\nExample:\n*** Begin Patch\n*** Add File: hello.txt\n+Hello world\n*** Update File: src/app.py\n@@ def greet():\n-print("Hi")\n+print("Hello, world!")\n*** Delete File: obsolete.txt\n*** End Patch\n\nPrefer this over edit/multiedit for multi-file changes.';
const createApplyPatchTool = (projectDir) => ai.tool({
  description: DESCRIPTION$1,
  inputSchema: v4.z.object({
    patchText: v4.z.string().describe("The full patch text with Begin/End markers")
  }),
  execute: async ({ patchText }) => {
    let hunks;
    try {
      hunks = parsePatch(patchText);
    } catch (e) {
      return `[Error parsing patch: ${e instanceof Error ? e.message : e}]`;
    }
    if (hunks.length === 0) return "[Error: patch contains no file operations]";
    const summary = [];
    for (const hunk of hunks) {
      const filePath = node_path.resolve(projectDir, hunk.path);
      try {
        switch (hunk.type) {
          case "add": {
            await promises$1.mkdir(node_path.dirname(filePath), { recursive: true });
            const content = hunk.contents.endsWith("\n") ? hunk.contents : hunk.contents + "\n";
            await promises$1.writeFile(filePath, content, "utf-8");
            summary.push(`A ${node_path.relative(projectDir, filePath)}`);
            break;
          }
          case "delete": {
            await promises$1.unlink(filePath);
            summary.push(`D ${node_path.relative(projectDir, filePath)}`);
            break;
          }
          case "update": {
            const s = await promises$1.stat(filePath).catch(() => null);
            if (!s || s.isDirectory()) return `[Error: cannot update ${hunk.path} — file not found]`;
            const newContent = deriveNewContents(filePath, hunk.chunks);
            const target = hunk.move_path ? node_path.resolve(projectDir, hunk.move_path) : filePath;
            if (hunk.move_path) {
              await promises$1.mkdir(node_path.dirname(target), { recursive: true });
              await promises$1.writeFile(target, newContent, "utf-8");
              await promises$1.unlink(filePath);
              summary.push(`M ${node_path.relative(projectDir, target)} (moved from ${node_path.relative(projectDir, filePath)})`);
            } else {
              await promises$1.writeFile(filePath, newContent, "utf-8");
              summary.push(`M ${node_path.relative(projectDir, filePath)}`);
            }
            break;
          }
        }
      } catch (e) {
        return `[Error applying hunk for ${hunk.path}: ${e instanceof Error ? e.message : e}]`;
      }
    }
    return `Patch applied successfully:
${summary.join("\n")}`;
  }
});
const DESCRIPTION = "Execute multiple tool calls concurrently to reduce latency. Pass an array of {tool, parameters} objects (1–25). All run in parallel. Partial failures do not stop other calls. Cannot nest batch inside batch.\n\nGood for: reading many files, grep+glob+read combos, multiple bash commands, multi-file edits.\nBad for: operations that depend on prior output, ordered stateful mutations.";
const createBatchTool = (getTools) => ai.tool({
  description: DESCRIPTION,
  inputSchema: v4.z.object({
    tool_calls: v4.z.array(
      v4.z.object({
        tool: v4.z.string().describe("The name of the tool to execute"),
        parameters: v4.z.record(v4.z.string(), v4.z.any()).describe("Parameters for the tool")
      })
    ).min(1).max(25).describe("Array of tool calls to execute in parallel")
  }),
  execute: async ({ tool_calls }) => {
    const tools = getTools();
    const results = await Promise.all(
      tool_calls.map(async (call) => {
        try {
          if (call.tool === "batch") {
            return { tool: call.tool, success: false, output: "Cannot nest batch inside batch" };
          }
          const t = tools[call.tool];
          if (!t) {
            return { tool: call.tool, success: false, output: `Unknown tool: ${call.tool}` };
          }
          if (!t.execute) {
            return { tool: call.tool, success: false, output: `Tool ${call.tool} has no execute function` };
          }
          const output = await t.execute(call.parameters, { toolCallId: call.tool, messages: [], abortSignal: new AbortController().signal });
          return { tool: call.tool, success: true, output };
        } catch (e) {
          return { tool: call.tool, success: false, output: e instanceof Error ? e.message : String(e) };
        }
      })
    );
    const ok = results.filter((r) => r.success).length;
    const fail = results.length - ok;
    const lines = results.map((r, i) => {
      const status = r.success ? "ok" : "FAIL";
      const out = typeof r.output === "string" ? r.output : JSON.stringify(r.output);
      return `[${i + 1}] ${r.tool} (${status}):
${out}`;
    });
    const header = fail > 0 ? `${ok}/${results.length} succeeded, ${fail} failed.` : `All ${ok} tools executed successfully.`;
    return `${header}

${lines.join("\n\n")}`;
  }
});
function createTools(projectDir, supportsVision = true, sessionId = "default", getWindow2) {
  const agentTools = {
    read: createReadTool(projectDir),
    glob: createGlobTool(projectDir),
    grep: createGrepTool(projectDir),
    ls: createLsTool(projectDir),
    bash: createBashTool(projectDir),
    webfetch: createWebFetchTool(),
    imagefetch: createImageFetchTool(),
    skill: createSkillTool(),
    browser: createBrowserTool(getWindow2 ?? (() => null), supportsVision),
    write: createWriteTool(projectDir),
    edit: createEditTool(projectDir),
    multiedit: createMultiEditTool(projectDir),
    apply_patch: createApplyPatchTool(projectDir),
    todo_write: createTodoWriteTool(sessionId),
    todo_read: createTodoReadTool(sessionId),
    imagesave: createImageSaveTool(projectDir, sessionId)
  };
  agentTools.batch = createBatchTool(() => agentTools);
  return agentTools;
}
const activeStreams = /* @__PURE__ */ new Map();
function registerChatHandlers(getWindow2) {
  electron.ipcMain.handle(
    "chat:stream",
    async (_e, params) => {
      const {
        sessionId,
        prompt,
        providerId,
        modelId,
        images
      } = params;
      const projectDir = params.projectDir || process.cwd();
      const controller = new AbortController();
      activeStreams.set(sessionId, controller);
      const win = getWindow2();
      try {
        await messageDb.append(sessionId, "user", prompt, images);
        const resolved = await resolveProvider(providerId, modelId);
        if (isResolveError(resolved)) {
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "error", message: resolved.error }
          });
          return;
        }
        const history = messageDb.listBySession(sessionId);
        const msgs = history.map((m) => {
          if (m.role === "user" && m.images) {
            try {
              const imgs = JSON.parse(m.images);
              if (imgs.length > 0) {
                const parts = imgs.map((dataUrl) => ({
                  type: "image",
                  image: dataUrl
                }));
                parts.push({ type: "text", text: m.content });
                return { role: "user", content: parts };
              }
            } catch {
            }
          }
          return {
            role: m.role,
            content: m.content
          };
        });
        if (images && images.length > 0) {
          const parts = images.map((dataUrl) => ({
            type: "image",
            image: dataUrl
          }));
          parts.push({ type: "text", text: prompt });
          msgs.push({ role: "user", content: parts });
        } else {
          msgs.push({ role: "user", content: prompt });
        }
        const home = os.homedir();
        const skills = await discoverSkills();
        const systemPrompt = buildAgentSystemPrompt(
          modelId,
          home,
          projectDir,
          skills
        );
        const supportsVision = await modelSupportsImage(providerId, modelId);
        const tools = createTools(projectDir, supportsVision, sessionId, getWindow2);
        const result = ai.streamText({
          model: resolved.model,
          system: systemPrompt,
          messages: msgs,
          tools,
          stopWhen: ai.stepCountIs(25),
          abortSignal: controller.signal
        });
        let fullContent = "";
        for await (const part of result.fullStream) {
          if (controller.signal.aborted) break;
          let event = null;
          switch (part.type) {
            case "text-delta":
              fullContent += part.text;
              event = { type: "token", content: part.text };
              break;
            case "tool-call":
              event = {
                type: "tool_call",
                name: part.toolName,
                input: part.input,
                toolCallId: part.toolCallId
              };
              break;
            case "tool-result":
              event = {
                type: "tool_result",
                name: part.toolName,
                output: part.output
              };
              break;
            case "error": {
              const errMsg = part.error instanceof Error ? part.error.message : String(part.error);
              event = { type: "error", message: errMsg };
              break;
            }
            default:
              break;
          }
          if (event) {
            win?.webContents.send("chat:event", { sessionId, event });
          }
        }
        if (fullContent.length > 0) {
          const saved = messageDb.append(sessionId, "assistant", fullContent);
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "done", messageId: saved.id }
          });
        } else {
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "done", messageId: "" }
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : "Internal error";
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "error", message: errorMessage }
          });
        }
      } finally {
        activeStreams.delete(sessionId);
      }
    }
  );
  electron.ipcMain.handle("chat:stop", (_e, sessionId) => {
    const controller = activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      activeStreams.delete(sessionId);
    }
    return { ok: true };
  });
}
function buildAgentSystemPrompt(modelId, home, projectDir, skills) {
  const skillContext = skills.length > 0 ? `

You have access to specialized skills. When a task matches one of these skills, use the \`skill\` tool to load its instructions:
${skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n")}` : "";
  return [
    `You are Coodeen, the best coding agent on the planet.`,
    `You are powered by the model named ${modelId}.`,
    ``,
    `<env>`,
    `Working directory: ${projectDir}`,
    `Home directory: ${home}`,
    `Platform: ${process.platform}`,
    `Today's date: ${(/* @__PURE__ */ new Date()).toDateString()}`,
    `</env>`,
    ``,
    `# Tone and style`,
    `- Only use emojis if the user explicitly requests it.`,
    `- Your responses should be short and concise. You can use GitHub-flavored markdown for formatting.`,
    `- Output text to communicate with the user; all text you output outside of tool use is displayed to the user. Only use tools to complete tasks. Never use tools like bash or code comments as means to communicate with the user.`,
    `- NEVER create files unless they're absolutely necessary for achieving your goal. ALWAYS prefer editing an existing file to creating a new one.`,
    ``,
    `# Professional objectivity`,
    `Prioritize technical accuracy and truthfulness over validating the user's beliefs. Focus on facts and problem-solving, providing direct, objective technical info without any unnecessary superlatives, praise, or emotional validation.`,
    ``,
    `# Required workflow for every user request`,
    `For ANY non-trivial user request (questions, changes, bugs, features), you MUST follow this order:`,
    `1. **Explore first.** Before answering or editing, use \`glob\`, \`grep\`, \`ls\`, and \`read\` to understand the relevant parts of the project. Do not skip this step — even for simple-sounding asks, verify assumptions against the actual code.`,
    `2. **Plan with todo_write.** Immediately after exploring, call \`todo_write\` with a detailed checklist covering every step needed. Each item must be concrete and independently verifiable. Mark the first item \`in_progress\`, the rest \`pending\`. This list is rendered visually in the chat so the user sees progress live.`,
    `3. **Execute.** Work the list top-to-bottom using the appropriate tools (edit, write, multiedit, apply_patch, bash, etc.).`,
    `4. **Update todo_write after every completed step.** Re-call \`todo_write\` with the full updated list — flip the finished item to \`completed\` and the next to \`in_progress\`. Never batch multiple completions; update the list immediately when a step is done.`,
    `5. **Finish.** When all items are \`completed\`, give a short final message summarizing the result.`,
    ``,
    `Skip ONLY for genuinely trivial single-step requests (e.g. "what is 2+2", a one-line conceptual answer). Anything touching code = full workflow.`,
    `If you edit/write without first exploring and creating a todo_write, you have failed the workflow. Stop, explore, plan, then act.`,
    ``,
    `# Doing tasks`,
    `The user will primarily request you perform software engineering tasks. This includes solving bugs, adding new functionality, refactoring code, explaining code, and more.`,
    ``,
    `# CRITICAL: Act, don't narrate`,
    `- When the user describes how something should look or behave ("it should be like that", "it will be like that", "it must be X", "I expect X", "make it Y", "the image should be on the right", etc.), this is an INSTRUCTION TO CODE. You must immediately use tools (read, edit, write, bash) to implement the change. NEVER just respond with "Done" or "Updated" without actually calling tools to make the change.`,
    `- Every user message that implies a change REQUIRES tool calls. If your response has zero tool calls but describes changes you "made", you failed. Go back and actually make the changes using tools.`,
    `- NEVER say "Done", "Updated", "Fixed", "Changed" unless you have actually called edit/write/multiedit tools in that same response and the tool results confirm success.`,
    `- If the user shows you a screenshot or describes a visual issue, you MUST read the relevant file, find the code responsible, and edit it. Do not guess — read first, then edit.`,
    ``,
    `# Tool usage policy`,
    `- You can call multiple tools in a single response. If you intend to call multiple tools and there are no dependencies between them, make all independent tool calls in parallel.`,
    `- Use specialized tools instead of bash commands when possible. For file operations, use dedicated tools: read for reading files instead of cat/head/tail, edit for editing instead of sed/awk, and write for creating files instead of cat with heredoc or echo redirection. Reserve bash exclusively for actual system commands and terminal operations.`,
    `- NEVER use bash echo or other command-line tools to communicate thoughts, explanations, or instructions to the user. Output all communication directly in your response text instead.`,
    `- When making multiple changes to the same file, use multiedit instead of multiple edit calls.`,
    ``,
    `# Code References`,
    `When referencing specific functions or pieces of code include the pattern \`file_path:line_number\` to allow the user to easily navigate to the source code location.`,
    ``,
    `# Git`,
    `- Only create commits when requested by the user. If unclear, ask first.`,
    `- NEVER update the git config.`,
    `- NEVER run destructive git commands (push --force, hard reset, etc) unless the user explicitly requests them.`,
    `- NEVER skip hooks (--no-verify) unless the user explicitly requests it.`,
    `- NEVER commit changes unless the user explicitly asks you to.`
  ].join("\n") + skillContext;
}
const HIDDEN = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".next",
  ".cache",
  ".Trash",
  "__pycache__",
  ".tox",
  ".venv",
  "dist",
  ".turbo",
  ".DS_Store"
]);
const EXT_LANG = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".toml": "toml",
  ".ini": "ini",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".svg": "xml",
  ".dockerfile": "dockerfile",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".dart": "dart",
  ".lua": "lua",
  ".r": "r",
  ".vue": "html",
  ".svelte": "html"
};
const BINARY_EXTS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".avif",
  ".mp3",
  ".mp4",
  ".wav",
  ".avi",
  ".mov",
  ".mkv",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".sqlite",
  ".db"
]);
function isBinary(name) {
  return BINARY_EXTS.has(node_path.extname(name).toLowerCase());
}
function detectLanguage(name) {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower === ".gitignore" || lower === ".dockerignore") return "plaintext";
  return EXT_LANG[node_path.extname(lower)] || "plaintext";
}
function registerFsHandlers() {
  electron.ipcMain.handle("fs:listDirs", async (_e, path2) => {
    const current = node_path.resolve(path2 || node_os.homedir());
    const parent = node_path.dirname(current) !== current ? node_path.dirname(current) : null;
    try {
      const entries = await promises$1.readdir(current, { withFileTypes: true });
      const dirs = entries.filter(
        (e) => e.isDirectory() && !e.name.startsWith(".") && !HIDDEN.has(e.name)
      ).map((e) => e.name).sort(
        (a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })
      );
      return { current, parent, dirs };
    } catch {
      throw new Error(`Cannot read directory: ${current}`);
    }
  });
  electron.ipcMain.handle("fs:listTree", async (_e, path2) => {
    const dirPath = node_path.resolve(path2);
    try {
      const entries = await promises$1.readdir(dirPath, { withFileTypes: true });
      const result = [];
      for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".env") continue;
        if (HIDDEN.has(entry.name)) continue;
        if (entry.isDirectory()) {
          result.push({ name: entry.name, type: "dir" });
        } else if (entry.isFile()) {
          result.push({ name: entry.name, type: "file" });
        }
      }
      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name, void 0, {
          sensitivity: "base"
        });
      });
      return { entries: result };
    } catch {
      throw new Error(`Cannot read directory: ${dirPath}`);
    }
  });
  electron.ipcMain.handle("fs:readFile", async (_e, path2) => {
    const filePath = node_path.resolve(path2);
    try {
      const s = await promises$1.stat(filePath);
      if (!s.isFile()) throw new Error("Not a file");
      if (isBinary(filePath)) {
        return { binary: true, size: s.size };
      }
      if (s.size > 2 * 1024 * 1024) {
        throw new Error(`File too large (> 2MB), size: ${s.size}`);
      }
      const content = await promises$1.readFile(filePath, "utf-8");
      const language = detectLanguage(filePath);
      return { content, language };
    } catch (err) {
      throw new Error(
        `Cannot read file: ${filePath} - ${err instanceof Error ? err.message : err}`
      );
    }
  });
  electron.ipcMain.handle(
    "fs:writeFile",
    async (_e, path2, content) => {
      const filePath = node_path.resolve(path2);
      try {
        await promises$1.mkdir(node_path.dirname(filePath), { recursive: true });
        await promises$1.writeFile(filePath, content, "utf-8");
        return { ok: true };
      } catch {
        throw new Error(`Cannot write file: ${filePath}`);
      }
    }
  );
  electron.ipcMain.handle(
    "fs:createEntry",
    async (_e, path2, type) => {
      const targetPath = node_path.resolve(path2);
      try {
        if (type === "dir") {
          await promises$1.mkdir(targetPath, { recursive: true });
        } else {
          await promises$1.mkdir(node_path.dirname(targetPath), { recursive: true });
          await promises$1.writeFile(targetPath, "", "utf-8");
        }
        return { ok: true };
      } catch {
        throw new Error(`Cannot create: ${targetPath}`);
      }
    }
  );
  electron.ipcMain.handle("fs:deleteEntry", async (_e, path2) => {
    const targetPath = node_path.resolve(path2);
    try {
      const s = await promises$1.stat(targetPath);
      await promises$1.rm(targetPath, { recursive: s.isDirectory(), force: true });
      return { ok: true };
    } catch {
      throw new Error(`Cannot delete: ${targetPath}`);
    }
  });
  electron.ipcMain.handle(
    "fs:upload",
    async (_e, dirPath, fileName, data) => {
      const targetDir = node_path.resolve(dirPath);
      await promises$1.mkdir(targetDir, { recursive: true });
      const targetPath = node_path.join(targetDir, fileName);
      await promises$1.writeFile(targetPath, Buffer.from(data));
      return { ok: true, name: fileName };
    }
  );
}
function isGitRepo(dir) {
  try {
    node_child_process.execSync("git rev-parse --git-dir", {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8"
    });
    return true;
  } catch {
    return false;
  }
}
function runGit(cmd, dir, opts) {
  try {
    return node_child_process.execSync(cmd, {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8"
    }).trim();
  } catch (error) {
    if (opts?.throwOnError) throw error;
    return `Error: ${error.message}`;
  }
}
function registerGitHandlers() {
  electron.ipcMain.handle("git:status", async (_e, dir) => {
    const d = node_path.resolve(dir);
    if (!isGitRepo(d)) {
      return { error: "Not a git repository", isGitRepo: false };
    }
    const branch = runGit("git rev-parse --abbrev-ref HEAD", d);
    let status = "";
    try {
      status = node_child_process.execSync("git status --porcelain", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trimEnd();
    } catch {
    }
    let ahead = "0";
    let behind = "0";
    try {
      ahead = node_child_process.execSync("git rev-list --count @{u}..HEAD", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trim();
    } catch {
      try {
        ahead = node_child_process.execSync(`git rev-list --count origin/${branch}..HEAD`, {
          cwd: d,
          stdio: "pipe",
          encoding: "utf-8"
        }).trim();
      } catch {
      }
    }
    try {
      behind = node_child_process.execSync("git rev-list --count HEAD..@{u}", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trim();
    } catch {
      try {
        behind = node_child_process.execSync(`git rev-list --count HEAD..origin/${branch}`, {
          cwd: d,
          stdio: "pipe",
          encoding: "utf-8"
        }).trim();
      } catch {
      }
    }
    const changes = status.split("\n").filter((line) => line.trim()).map((line) => ({
      file: line.substring(3),
      index: line[0] === " " ? "" : line[0],
      workTree: line[1] === " " ? "" : line[1],
      status: line.substring(0, 2).trim()
    }));
    const merging = runGit("git status --short", d).includes("UU");
    return {
      isGitRepo: true,
      branch,
      changes,
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0,
      isMerging: merging,
      directory: d
    };
  });
  electron.ipcMain.handle("git:branches", async (_e, dir) => {
    const d = node_path.resolve(dir);
    if (!isGitRepo(d)) {
      throw new Error("Not a git repository");
    }
    const currentBranch = runGit("git rev-parse --abbrev-ref HEAD", d);
    const branchList = runGit("git branch -a", d);
    const branches = branchList.split("\n").map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const isRemote = trimmed.startsWith("remotes/");
      const isCurrent = trimmed.startsWith("*");
      const name = trimmed.replace(/^\*\s+/, "").replace(/^remotes\//, "");
      return {
        name,
        isCurrent: isCurrent || name === currentBranch,
        isRemote,
        fullRef: trimmed.replace("* ", "")
      };
    }).filter(Boolean);
    return { branches, currentBranch };
  });
  electron.ipcMain.handle("git:checkout", async (_e, dir, branch) => {
    const d = node_path.resolve(dir);
    runGit(`git checkout ${branch}`, d, { throwOnError: true });
    return { ok: true, branch };
  });
  electron.ipcMain.handle("git:createBranch", async (_e, dir, branch) => {
    const d = node_path.resolve(dir);
    runGit(`git branch ${branch}`, d, { throwOnError: true });
    return { ok: true, branch };
  });
  electron.ipcMain.handle(
    "git:deleteBranch",
    async (_e, dir, branch, force) => {
      const d = node_path.resolve(dir);
      const flag = force ? "-D" : "-d";
      runGit(`git branch ${flag} ${branch}`, d, { throwOnError: true });
      return { ok: true, branch };
    }
  );
  electron.ipcMain.handle("git:merge", async (_e, dir, branch) => {
    const d = node_path.resolve(dir);
    try {
      runGit(`git merge ${branch}`, d, { throwOnError: true });
      const newStatus = runGit("git status --short", d);
      const hasConflicts = newStatus.includes("UU") || newStatus.includes("AA");
      return { ok: true, merged: !hasConflicts, hasConflicts };
    } catch (error) {
      const err = error;
      const hasConflicts = err.message.includes("CONFLICT");
      return { error: err.message, hasConflicts, ok: false };
    }
  });
  electron.ipcMain.handle("git:conflicts", async (_e, dir) => {
    const d = node_path.resolve(dir);
    const diff = runGit(
      "git diff --name-only --diff-filter=U",
      d
    );
    const conflicts = diff.split("\n").filter((line) => line.trim()).map((file) => ({ file, type: "conflict" }));
    return { conflicts };
  });
  electron.ipcMain.handle("git:diff", async (_e, dir, file) => {
    const d = node_path.resolve(dir);
    const diff = file ? runGit(`git diff ${file}`, d) : runGit("git diff", d);
    return { diff };
  });
  electron.ipcMain.handle(
    "git:stage",
    async (_e, dir, files) => {
      const d = node_path.resolve(dir);
      const fileArgs = files.map((f) => `"${f}"`).join(" ");
      runGit(`git add -- ${fileArgs}`, d, { throwOnError: true });
      return { ok: true };
    }
  );
  electron.ipcMain.handle(
    "git:unstage",
    async (_e, dir, files) => {
      const d = node_path.resolve(dir);
      const fileArgs = files.map((f) => `"${f}"`).join(" ");
      runGit(`git reset HEAD -- ${fileArgs}`, d, { throwOnError: true });
      return { ok: true };
    }
  );
  electron.ipcMain.handle(
    "git:commit",
    async (_e, dir, message) => {
      const d = node_path.resolve(dir);
      const result = node_child_process.spawnSync("git", ["commit", "-F", "-"], {
        cwd: d,
        input: message.trim(),
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8"
      });
      if (result.status !== 0) {
        throw new Error(
          result.stderr || result.stdout || "Commit failed"
        );
      }
      return { ok: true };
    }
  );
  electron.ipcMain.handle("git:push", async (_e, dir) => {
    const d = node_path.resolve(dir);
    try {
      runGit("git push", d, { throwOnError: true });
      return { ok: true };
    } catch {
      runGit("git push -u origin HEAD", d, { throwOnError: true });
      return { ok: true };
    }
  });
  electron.ipcMain.handle("git:pull", async (_e, dir) => {
    const d = node_path.resolve(dir);
    runGit("git pull", d, { throwOnError: true });
    return { ok: true };
  });
  electron.ipcMain.handle(
    "git:discard",
    async (_e, dir, files) => {
      const d = node_path.resolve(dir);
      const statusRaw = node_child_process.execSync("git status --porcelain", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8"
      }).trimEnd();
      const untrackedFiles = new Set(
        statusRaw.split("\n").filter((l) => l.startsWith("??")).map((l) => l.substring(3))
      );
      const trackedFiles = files.filter((f) => !untrackedFiles.has(f));
      const newFiles = files.filter((f) => untrackedFiles.has(f));
      if (trackedFiles.length > 0) {
        const args = trackedFiles.map((f) => `"${f}"`).join(" ");
        runGit(`git checkout -- ${args}`, d, { throwOnError: true });
      }
      if (newFiles.length > 0) {
        for (const f of newFiles) {
          node_child_process.execSync(`rm -f "${f}"`, { cwd: d, stdio: "pipe" });
        }
      }
      return { ok: true };
    }
  );
}
const sessions = /* @__PURE__ */ new Map();
let idCounter = 0;
function generateId() {
  return `pty_${Date.now()}_${++idCounter}`;
}
function detectShell() {
  return process.env.SHELL || "/bin/sh";
}
async function spawnPty(command, args, cwd, env) {
  try {
    const nodePty = await import("@lydell/node-pty");
    const raw = nodePty.spawn(command, args, {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env
    });
    return {
      pid: raw.pid,
      onData: (cb) => {
        raw.onData(cb);
      },
      onExit: (cb) => {
        raw.onExit(cb);
      },
      resize: (cols, rows) => {
        raw.resize(cols, rows);
      },
      write: (data) => {
        raw.write(data);
      },
      kill: () => {
        raw.kill();
      }
    };
  } catch {
    throw new Error(
      "No PTY backend available. Install @lydell/node-pty."
    );
  }
}
function registerPtyHandlers(getWindow2) {
  electron.ipcMain.handle(
    "pty:create",
    async (_e, opts) => {
      const id = generateId();
      const command = opts?.command || detectShell();
      const args = [];
      if (command.endsWith("sh")) {
        args.push("-l");
      }
      const cwd = opts?.cwd || process.cwd();
      const env = {
        ...process.env,
        TERM: "xterm-256color"
      };
      const ptyProcess = await spawnPty(command, args, cwd, env);
      const session = {
        id,
        title: opts?.title || `Terminal ${id.slice(-4)}`,
        command,
        cwd,
        status: "running",
        pid: ptyProcess.pid,
        process: ptyProcess
      };
      sessions.set(id, session);
      ptyProcess.onData((data) => {
        const win = getWindow2();
        win?.webContents.send("pty:data", { id, data });
      });
      ptyProcess.onExit(({ exitCode }) => {
        const win = getWindow2();
        win?.webContents.send("pty:exit", { id, exitCode });
        session.status = "exited";
        sessions.delete(id);
      });
      return {
        id,
        title: session.title,
        command: session.command,
        cwd: session.cwd,
        status: session.status,
        pid: session.pid
      };
    }
  );
  electron.ipcMain.handle("pty:write", (_e, id, data) => {
    const session = sessions.get(id);
    if (session && session.status === "running") {
      session.process.write(data);
    }
  });
  electron.ipcMain.handle(
    "pty:resize",
    (_e, id, cols, rows) => {
      const session = sessions.get(id);
      if (session && session.status === "running") {
        session.process.resize(cols, rows);
      }
      return { ok: true };
    }
  );
  electron.ipcMain.handle("pty:kill", (_e, id) => {
    const session = sessions.get(id);
    if (session) {
      try {
        session.process.kill();
      } catch {
      }
      sessions.delete(id);
    }
    return { ok: true };
  });
  electron.ipcMain.handle("pty:list", () => {
    return Array.from(sessions.values()).map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status
    }));
  });
}
function maskKey(key) {
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}
function registerProviderHandlers() {
  electron.ipcMain.handle("providers:list", () => {
    const list = providerDb.list();
    return list.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) }));
  });
  electron.ipcMain.handle("providers:models", async (_e, providerName) => {
    const name = providerName.toLowerCase();
    const config2 = await getModelsConfig();
    if (name === config2.free.provider) {
      const free = await getFreeModels();
      return { provider: name, models: free.map((m) => m.id) };
    }
    const entry = config2.providers[name];
    if (!entry) {
      const supported = [
        ...Object.keys(config2.providers),
        config2.free.provider
      ].join(", ");
      throw new Error(
        `Unknown provider: ${name}. Supported: ${supported}`
      );
    }
    return { provider: name, models: entry.models.map((m) => m.id) };
  });
  electron.ipcMain.handle("providers:connectedModels", async () => {
    const [list, config2, free] = await Promise.all([
      providerDb.list(),
      getModelsConfig(),
      getFreeModels()
    ]);
    const result = [
      {
        providerId: config2.free.provider,
        label: config2.free.label,
        models: free.map((m) => m.id),
        free: true
      }
    ];
    for (const p of list) {
      const entry = config2.providers[p.id];
      if (entry) {
        result.push({
          providerId: p.id,
          label: entry.label,
          models: entry.models.map((m) => m.id)
        });
      }
    }
    return result;
  });
  electron.ipcMain.handle("providers:freeModels", async () => {
    return getFreeModels();
  });
  electron.ipcMain.handle("providers:config", async () => {
    return getModelsConfig();
  });
  electron.ipcMain.handle(
    "providers:upsert",
    (_e, id, data) => {
      const result = providerDb.upsert(id, {
        apiKey: data.apiKey,
        modelId: ""
      });
      return { ...result, apiKey: maskKey(result.apiKey) };
    }
  );
  electron.ipcMain.handle("providers:delete", (_e, id) => {
    providerDb.delete(id);
    return { ok: true };
  });
}
const configDb = {
  get(key) {
    const db = getDb();
    const row = db.select().from(config).where(drizzleOrm.eq(config.key, key)).get();
    return row?.value ?? null;
  },
  set(key, value) {
    const db = getDb();
    const existing = db.select().from(config).where(drizzleOrm.eq(config.key, key)).get();
    if (existing) {
      db.update(config).set({ value, updatedAt: /* @__PURE__ */ new Date() }).where(drizzleOrm.eq(config.key, key)).run();
    } else {
      db.insert(config).values({ key, value }).run();
    }
  },
  delete(key) {
    const db = getDb();
    db.delete(config).where(drizzleOrm.eq(config.key, key)).run();
  }
};
function registerConfigHandlers() {
  electron.ipcMain.handle("config:getCwd", () => {
    return { cwd: process.cwd() };
  });
  electron.ipcMain.handle("config:getActiveProvider", () => {
    return configDb.get("active-provider");
  });
  electron.ipcMain.handle("config:setActiveProvider", (_e, value) => {
    configDb.set("active-provider", value);
    return { ok: true };
  });
}
function loadEnvFile(dirPath) {
  const envPath = node_path.resolve(dirPath, ".env");
  const env = { ...process.env };
  if (node_fs.existsSync(envPath)) {
    try {
      const content = node_fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (key) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
          env[key.trim()] = value;
        }
      }
    } catch {
    }
  }
  return env;
}
function registerActionHandlers() {
  electron.ipcMain.handle("actions:getConfig", async (_e, dir) => {
    const resolvedDir = node_path.resolve(dir);
    const configPath = node_path.resolve(resolvedDir, "coodeen.json");
    try {
      const content = await node_fs.promises.readFile(configPath, "utf-8");
      const config2 = JSON.parse(content);
      return {
        ok: true,
        actions: config2.actions || [],
        name: config2.name
      };
    } catch {
      return { ok: true, actions: [], name: "coodeen" };
    }
  });
  electron.ipcMain.handle("actions:run", async (_e, dir, script) => {
    const d = node_path.resolve(dir);
    const env = loadEnvFile(d);
    const child = node_child_process.spawn(script, {
      cwd: d,
      env,
      shell: true,
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return { ok: true, pid: child.pid };
  });
}
function registerSkillHandlers() {
  electron.ipcMain.handle("skills:list", async () => {
    return discoverSkills();
  });
  electron.ipcMain.handle(
    "skills:create",
    async (_e, name, description, content) => {
      return createSkill(name, description, content);
    }
  );
  electron.ipcMain.handle(
    "skills:createRaw",
    async (_e, slug, raw) => {
      await createSkillRaw(slug, raw);
      return { ok: true };
    }
  );
  electron.ipcMain.handle("skills:delete", async (_e, name) => {
    const ok = await deleteSkill(name);
    return { ok };
  });
}
let mainWindow = null;
function getWindow() {
  return mainWindow;
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(() => {
  getDb();
  registerSessionHandlers();
  registerChatHandlers(getWindow);
  registerFsHandlers();
  registerGitHandlers();
  registerPtyHandlers(getWindow);
  registerProviderHandlers();
  registerConfigHandlers();
  registerActionHandlers();
  registerSkillHandlers();
  electron.ipcMain.handle(
    "capture:area",
    async (_e, x, y, width, height) => {
      if (!mainWindow) return null;
      const image = await mainWindow.webContents.capturePage({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      });
      return image.toDataURL();
    }
  );
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
