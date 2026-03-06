import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";
import { createEditTool } from "./edit.js";
import { createMultiEditTool } from "./multiedit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";
import { createLsTool } from "./ls.js";
import { createWebFetchTool } from "./webfetch.js";
import { createWebSearchTool } from "./websearch.js";
import { createCodeSearchTool } from "./codesearch.js";
import { createImageFetchTool } from "./imagefetch.js";
import { createPlanWriteTool, createPlanExitTool } from "./plan.js";
import { createQuestionTool } from "./question.js";
import { createSkillTool } from "./skill.js";
import { createBashTool } from "./bash.js";
import { createTodoWriteTool, createTodoReadTool } from "./todo.js";
import { createImageSaveTool } from "./imagesave.js";

/**
 * Create all tools scoped to a specific project directory.
 * - Agent mode: full access (read + write + edit + multiedit + ls + todo + skill)
 * - Plan mode: read-only + plan_write (plan file only) + plan_exit + skill
 */
export function createTools(
  projectDir: string,
  mode: "agent" | "plan" = "agent",
  planPath?: string,
  supportsVision = true,
  sessionId = "default",
) {
  const base = {
    read: createReadTool(projectDir),
    glob: createGlobTool(projectDir),
    grep: createGrepTool(projectDir),
    ls: createLsTool(projectDir),
    bash: createBashTool(projectDir),
    webfetch: createWebFetchTool(),
    websearch: createWebSearchTool(),
    codesearch: createCodeSearchTool(),
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

  return {
    ...base,
    write: createWriteTool(projectDir),
    edit: createEditTool(projectDir),
    multiedit: createMultiEditTool(projectDir),
    todo_write: createTodoWriteTool(sessionId),
    todo_read: createTodoReadTool(sessionId),
    image_save: createImageSaveTool(projectDir, sessionId),
  };
}
