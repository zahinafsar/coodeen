import { eq, asc } from "drizzle-orm";
import { getDb } from "./client.js";
import { messages } from "./schema.js";

export const messageDb = {
  append(
    sessionId: string,
    role: string,
    content: string,
    images?: string[],
  ) {
    const db = getDb();
    return db
      .insert(messages)
      .values({
        sessionId,
        role,
        content,
        images: images?.length ? JSON.stringify(images) : null,
      })
      .returning()
      .get();
  },

  listBySession(sessionId: string) {
    const db = getDb();
    return db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .all();
  },
};
