import { eq, desc } from "drizzle-orm";
import { getDb } from "./client.js";
import { providers } from "./schema.js";

export const providerDb = {
  list() {
    const db = getDb();
    return db.select().from(providers).orderBy(desc(providers.createdAt)).all();
  },

  get(id: string) {
    const db = getDb();
    return db.select().from(providers).where(eq(providers.id, id)).get();
  },

  upsert(id: string, data: { apiKey: string; modelId: string }) {
    const db = getDb();
    const existing = db
      .select()
      .from(providers)
      .where(eq(providers.id, id))
      .get();

    if (existing) {
      return db
        .update(providers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(providers.id, id))
        .returning()
        .get();
    }

    return db
      .insert(providers)
      .values({ id, ...data })
      .returning()
      .get();
  },

  delete(id: string) {
    const db = getDb();
    db.delete(providers).where(eq(providers.id, id)).run();
  },
};
