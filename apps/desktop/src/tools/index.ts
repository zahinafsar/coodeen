import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";
import { createEditTool } from "./edit.js";
import { createMultiEditTool } from "./multiedit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";
import { createLsTool } from "./ls.js";
import { createWebFetchTool } from "./webfetch.js";
import { createImageFetchTool } from "./imagefetch.js";
import { createPlanWriteTool, createPlanExitTool } from "./plan.js";
import { createQuestionTool } from "./question.js";
import { createSkillTool } from "./skill.js";
import { createBashTool } from "./bash.js";
import { createTodoWriteTool, createTodoReadTool } from "./todo.js";
import { createImageSaveTool } from "./imagesave.js";
import { createApplyPatchTool } from "./patch.js";
import { createBatchTool } from "./batch.js";

/**
 * Create all tools scoped to a specific project directory.
 * - Agent mode: full access (read + write + edit + multiedit + ls + todo + skill + patch + batch)
 * - Plan mode: read-only + plan_write (plan file only) + plan_exit + skill
 */
export function createTools(
  projectDir: string,
  mode: "agent" | "plan" = "agent",
  options: {
    planPath?: string;
    supportsVision?: boolean;
    sessionId?: string;
  } = {},
) {
  const {
    planPath,
    supportsVision = true,
    sessionId = "default",
  } = options;

  const base = {
    read: createReadTool(projectDir),
    glob: createGlobTool(projectDir),
    grep: createGrepTool(projectDir),
    ls: createLsTool(projectDir),
    bash: createBashTool(projectDir),
    webfetch: createWebFetchTool(),
    imagefetch: createImageFetchTool(supportsVision),
    skill: createSkillTool(),
  };

  if (mode === "plan" && planPath) {
    return {
      ...base,
      question: createQuestionTool(),
      plan_write: createPlanWriteTool(planPath),
      plan_exit: createPlanExitTool(planPath),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentTools: Record<string, any> = {
    ...base,
    write: createWriteTool(projectDir),
    edit: createEditTool(projectDir),
    multiedit: createMultiEditTool(projectDir),
    apply_patch: createApplyPatchTool(projectDir),
    todo_write: createTodoWriteTool(sessionId),
    todo_read: createTodoReadTool(sessionId),
    imagesave: createImageSaveTool(projectDir, sessionId),
  };

  // Batch gets a lazy reference to the full tool set
  agentTools.batch = createBatchTool(() => agentTools);

  return agentTools;
}
