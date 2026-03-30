import { eq } from "drizzle-orm";
import { getDb } from "./client.js";
import { config } from "./schema.js";

export const configDb = {
  get(key: string): string | null {
    const db = getDb();
    const row = db.select().from(config).where(eq(config.key, key)).get();
    return row?.value ?? null;
  },

  set(key: string, value: string) {
    const db = getDb();
    const existing = db
      .select()
      .from(config)
      .where(eq(config.key, key))
      .get();

    if (existing) {
      db.update(config)
        .set({ value, updatedAt: new Date() })
        .where(eq(config.key, key))
        .run();
    } else {
      db.insert(config).values({ key, value }).run();
    }
  },

  delete(key: string) {
    const db = getDb();
    db.delete(config).where(eq(config.key, key)).run();
  },
};
