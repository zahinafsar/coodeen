import { createReadTool } from "../tools/read.js";
import { createWriteTool } from "../tools/write.js";
import { createEditTool } from "../tools/edit.js";
import { createMultiEditTool } from "../tools/multiedit.js";
import { createGlobTool } from "../tools/glob.js";
import { createGrepTool } from "../tools/grep.js";
import { createLsTool } from "../tools/ls.js";
import { createWebFetchTool } from "../tools/webfetch.js";
import { createWebSearchTool } from "../tools/websearch.js";
import { createCodeSearchTool } from "../tools/codesearch.js";
import { createImageFetchTool } from "../tools/imagefetch.js";
import { createPlanWriteTool, createPlanExitTool } from "../tools/plan.js";
import { createQuestionTool } from "../tools/question.js";
import { createSkillTool } from "../tools/skill.js";
import { createBashTool } from "../tools/bash.js";
import { createTodoWriteTool, createTodoReadTool } from "../tools/todo.js";
import { createImageSaveTool } from "../tools/imagesave.js";

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
