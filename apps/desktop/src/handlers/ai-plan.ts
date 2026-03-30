import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";

export function getPlanPath(projectDir: string, sessionId: string): string {
  return join(homedir(), ".coodeen", "plans", `${sessionId}.md`);
}

export async function readPlan(planPath: string): Promise<string | null> {
  try {
    return await readFile(planPath, "utf-8");
  } catch {
    return null;
  }
}

export async function writePlan(
  planPath: string,
  content: string,
): Promise<void> {
  await mkdir(dirname(planPath), { recursive: true });
  await writeFile(planPath, content, "utf-8");
}
