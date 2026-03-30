import { eq, desc } from "drizzle-orm";
import { getDb } from "./client.js";
import { sessions } from "./schema.js";

export const sessionDb = {
  create(data: {
    title: string;
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    previewUrl?: string;
  }) {
    const db = getDb();
    const result = db
      .insert(sessions)
      .values({
        title: data.title,
        providerId: data.providerId ?? null,
        modelId: data.modelId ?? null,
        projectDir: data.projectDir ?? null,
        previewUrl: data.previewUrl ?? null,
      })
      .returning()
      .get();
    return result;
  },

  get(id: string) {
    const db = getDb();
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  },

  list() {
    const db = getDb();
    return db.select().from(sessions).orderBy(desc(sessions.updatedAt)).all();
  },

  update(
    id: string,
    data: {
      title?: string;
      providerId?: string;
      modelId?: string;
      projectDir?: string;
      previewUrl?: string;
    },
  ) {
    const db = getDb();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.providerId !== undefined) updateData.providerId = data.providerId;
    if (data.modelId !== undefined) updateData.modelId = data.modelId;
    if (data.projectDir !== undefined) updateData.projectDir = data.projectDir;
    if (data.previewUrl !== undefined) updateData.previewUrl = data.previewUrl;

    return db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, id))
      .returning()
      .get();
  },

  delete(id: string) {
    const db = getDb();
    db.delete(sessions).where(eq(sessions.id, id)).run();
  },
};
