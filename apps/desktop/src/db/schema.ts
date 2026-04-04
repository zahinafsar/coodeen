import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

function cuid() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `c${ts}${rand}`;
}

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(cuid),
  title: text("title").notNull(),
  providerId: text("provider_id"),
  modelId: text("model_id"),
  projectDir: text("project_dir"),
  previewUrl: text("preview_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(cuid),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  images: text("images"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  apiKey: text("api_key").notNull(),
  modelId: text("model_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
