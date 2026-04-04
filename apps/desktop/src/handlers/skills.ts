import { ipcMain } from "electron";
import {
  discoverSkills,
  createSkill,
  createSkillRaw,
  deleteSkill,
} from "./skills-scanner.js";

export function registerSkillHandlers() {
  ipcMain.handle("skills:list", async () => {
    return discoverSkills();
  });

  ipcMain.handle(
    "skills:create",
    async (_e, name: string, description: string, content: string) => {
      return createSkill(name, description, content);
    },
  );

  ipcMain.handle(
    "skills:createRaw",
    async (_e, slug: string, raw: string) => {
      await createSkillRaw(slug, raw);
      return { ok: true };
    },
  );

  ipcMain.handle("skills:delete", async (_e, name: string) => {
    const ok = await deleteSkill(name);
    return { ok };
  });
}
