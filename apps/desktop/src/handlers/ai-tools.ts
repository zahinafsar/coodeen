import { createReadTool } from "../tools/read.js";
import { createWriteTool } from "../tools/write.js";
import { createEditTool } from "../tools/edit.js";
import { createMultiEditTool } from "../tools/multiedit.js";
import { createGlobTool } from "../tools/glob.js";
import { createGrepTool } from "../tools/grep.js";
import { createLsTool } from "../tools/ls.js";
import { createWebFetchTool } from "../tools/webfetch.js";
import { createImageFetchTool } from "../tools/imagefetch.js";
import { createSkillTool } from "../tools/skill.js";
import { createBashTool } from "../tools/bash.js";
import { createTodoWriteTool, createTodoReadTool } from "../tools/todo.js";
import { createImageSaveTool } from "../tools/imagesave.js";
import { createBrowserTool } from "../tools/browser.js";
import { createApplyPatchTool } from "../tools/patch.js";
import { createBatchTool } from "../tools/batch.js";
import type { BrowserWindow } from "electron";

export function createTools(
  projectDir: string,
  supportsVision = true,
  sessionId = "default",
  getWindow?: () => BrowserWindow | null,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentTools: Record<string, any> = {
    read: createReadTool(projectDir),
    glob: createGlobTool(projectDir),
    grep: createGrepTool(projectDir),
    ls: createLsTool(projectDir),
    bash: createBashTool(projectDir),
    webfetch: createWebFetchTool(),
    imagefetch: createImageFetchTool(supportsVision),
    skill: createSkillTool(),
    browser: createBrowserTool(getWindow ?? (() => null), supportsVision),
    write: createWriteTool(projectDir),
    edit: createEditTool(projectDir),
    multiedit: createMultiEditTool(projectDir),
    apply_patch: createApplyPatchTool(projectDir),
    todo_write: createTodoWriteTool(sessionId),
    todo_read: createTodoReadTool(sessionId),
    imagesave: createImageSaveTool(projectDir, sessionId),
  };

  // Batch gets a lazy reference so it can invoke sibling tools
  agentTools.batch = createBatchTool(() => agentTools);

  return agentTools;
}
