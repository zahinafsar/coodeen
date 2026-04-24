import { ipcMain, type BrowserWindow } from "electron";
import { streamText, stepCountIs } from "ai";
import { messageDb } from "../db/messages.js";
import { resolveProvider, isResolveError } from "./ai-providers.js";
import { createTools } from "./ai-tools.js";
import { modelSupportsImage } from "./ai-models.js";
import { discoverSkills } from "./skills-scanner.js";
import { homedir } from "os";

export type AgentEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; input: unknown; toolCallId: string }
  | { type: "tool_result"; name: string; output: unknown }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

// Track active abort controllers per session
const activeStreams = new Map<string, AbortController>();

export function registerChatHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(
    "chat:stream",
    async (
      _e,
      params: {
        sessionId: string;
        prompt: string;
        providerId: string;
        modelId: string;
        projectDir?: string;
        images?: string[];
      },
    ) => {
      const {
        sessionId,
        prompt,
        providerId,
        modelId,
        images,
      } = params;
      const projectDir = params.projectDir || process.cwd();

      const controller = new AbortController();
      activeStreams.set(sessionId, controller);

      const win = getWindow();

      try {
        // Save user message
        await messageDb.append(sessionId, "user", prompt, images);

        // Resolve provider
        const resolved = await resolveProvider(providerId, modelId);
        if (isResolveError(resolved)) {
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "error", message: resolved.error },
          });
          return;
        }

        // Build conversation history
        const history = messageDb.listBySession(sessionId);
        type TextContent = { role: "user" | "assistant" | "system"; content: string };
        type MultiPartContent = {
          role: "user";
          content: Array<{ type: "text"; text: string } | { type: "image"; image: string }>;
        };
        const msgs: Array<TextContent | MultiPartContent> = history.map((m) => {
          if (m.role === "user" && m.images) {
            try {
              const imgs: string[] = JSON.parse(m.images);
              if (imgs.length > 0) {
                const parts: MultiPartContent["content"] = imgs.map((dataUrl) => ({
                  type: "image" as const,
                  image: dataUrl,
                }));
                parts.push({ type: "text", text: m.content });
                return { role: "user" as const, content: parts };
              }
            } catch {}
          }
          return {
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          };
        });

        // Append current prompt
        if (images && images.length > 0) {
          const parts: MultiPartContent["content"] = images.map((dataUrl) => ({
            type: "image" as const,
            image: dataUrl,
          }));
          parts.push({ type: "text", text: prompt });
          msgs.push({ role: "user", content: parts });
        } else {
          msgs.push({ role: "user", content: prompt });
        }

        // System prompt
        const home = homedir();
        const skills = await discoverSkills();
        const systemPrompt = buildAgentSystemPrompt(
          modelId,
          home,
          projectDir,
          skills,
        );

        // Create tools
        const supportsVision = await modelSupportsImage(providerId, modelId);
        const tools = createTools(projectDir, supportsVision, sessionId, getWindow);

        // Stream
        const result = streamText({
          model: resolved.model,
          system: systemPrompt,
          messages: msgs,
          tools,
          stopWhen: stepCountIs(25),
          abortSignal: controller.signal,
        });

        let fullContent = "";

        for await (const part of result.fullStream) {
          if (controller.signal.aborted) break;

          let event: AgentEvent | null = null;

          switch (part.type) {
            case "text-delta":
              fullContent += part.text;
              event = { type: "token", content: part.text };
              break;
            case "tool-call":
              event = {
                type: "tool_call",
                name: part.toolName,
                input: part.input,
                toolCallId: part.toolCallId,
              };
              break;
            case "tool-result":
              event = {
                type: "tool_result",
                name: part.toolName,
                output: part.output,
              };
              break;
            case "error": {
              const errMsg =
                part.error instanceof Error
                  ? part.error.message
                  : String(part.error);
              event = { type: "error", message: errMsg };
              break;
            }
            default:
              break;
          }

          if (event) {
            win?.webContents.send("chat:event", { sessionId, event });
          }
        }

        // Save assistant message
        if (fullContent.length > 0) {
          const saved = messageDb.append(sessionId, "assistant", fullContent);
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "done", messageId: saved.id },
          });
        } else {
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "done", messageId: "" },
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage =
            err instanceof Error ? err.message : "Internal error";
          win?.webContents.send("chat:event", {
            sessionId,
            event: { type: "error", message: errorMessage },
          });
        }
      } finally {
        activeStreams.delete(sessionId);
      }
    },
  );

  ipcMain.handle("chat:stop", (_e, sessionId: string) => {
    const controller = activeStreams.get(sessionId);
    if (controller) {
      controller.abort();
      activeStreams.delete(sessionId);
    }
    return { ok: true };
  });
}

function buildAgentSystemPrompt(
  modelId: string,
  home: string,
  projectDir: string,
  skills: Array<{ name: string; description: string }>,
): string {
  const skillContext =
    skills.length > 0
      ? `\n\nYou have access to specialized skills. When a task matches one of these skills, use the \`skill\` tool to load its instructions:\n${skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n")}`
      : "";

  return (
    [
      `You are Coodeen, the best coding agent on the planet.`,
      `You are powered by the model named ${modelId}.`,
      ``,
      `<env>`,
      `Working directory: ${projectDir}`,
      `Home directory: ${home}`,
      `Platform: ${process.platform}`,
      `Today's date: ${new Date().toDateString()}`,
      `</env>`,
      ``,
      `# Tone and style`,
      `- Only use emojis if the user explicitly requests it.`,
      `- Your responses should be short and concise. You can use GitHub-flavored markdown for formatting.`,
      `- Output text to communicate with the user; all text you output outside of tool use is displayed to the user. Only use tools to complete tasks. Never use tools like bash or code comments as means to communicate with the user.`,
      `- NEVER create files unless they're absolutely necessary for achieving your goal. ALWAYS prefer editing an existing file to creating a new one.`,
      ``,
      `# Professional objectivity`,
      `Prioritize technical accuracy and truthfulness over validating the user's beliefs. Focus on facts and problem-solving, providing direct, objective technical info without any unnecessary superlatives, praise, or emotional validation.`,
      ``,
      `# Required workflow for every user request`,
      `For ANY non-trivial user request (questions, changes, bugs, features), you MUST follow this order:`,
      `0. **If the user attached images, analyze them FIRST.** Images are the primary source of truth for what the user wants. Describe what you see (layout, elements, colors, spacing, states, errors) silently in your reasoning, map each visual element to the likely code location, and let those observations drive the exploration and plan. Never skip, skim, or ignore an attached image — if an image is attached and your plan does not reference specific visual details from it, you have failed.`,
      `1. **Explore.** Use \`glob\`, \`grep\`, \`ls\`, and \`read\` to understand the relevant parts of the project. Do not skip this step — even for simple-sounding asks, verify assumptions against the actual code. If an image was attached, target your search at the components visible in the image.`,
      `2. **Plan with todo_write.** Immediately after exploring, call \`todo_write\` with a detailed checklist covering every step needed. Each item must be concrete and independently verifiable. Mark the first item \`in_progress\`, the rest \`pending\`. This list is rendered visually in the chat so the user sees progress live.`,
      `3. **Execute.** Work the list top-to-bottom using the appropriate tools (edit, write, multiedit, apply_patch, bash, etc.).`,
      `4. **Update todo_write after every completed step.** Re-call \`todo_write\` with the full updated list — flip the finished item to \`completed\` and the next to \`in_progress\`. Never batch multiple completions; update the list immediately when a step is done.`,
      `5. **Finish.** When all items are \`completed\`, give a short final message summarizing the result.`,
      ``,
      `Skip ONLY for genuinely trivial single-step requests (e.g. "what is 2+2", a one-line conceptual answer). Anything touching code = full workflow.`,
      `If you edit/write without first exploring and creating a todo_write, you have failed the workflow. Stop, explore, plan, then act.`,
      ``,
      `# Doing tasks`,
      `The user will primarily request you perform software engineering tasks. This includes solving bugs, adding new functionality, refactoring code, explaining code, and more.`,
      ``,
      `# CRITICAL: Act, don't narrate`,
      `- When the user describes how something should look or behave ("it should be like that", "it will be like that", "it must be X", "I expect X", "make it Y", "the image should be on the right", etc.), this is an INSTRUCTION TO CODE. You must immediately use tools (read, edit, write, bash) to implement the change. NEVER just respond with "Done" or "Updated" without actually calling tools to make the change.`,
      `- Every user message that implies a change REQUIRES tool calls. If your response has zero tool calls but describes changes you "made", you failed. Go back and actually make the changes using tools.`,
      `- NEVER say "Done", "Updated", "Fixed", "Changed" unless you have actually called edit/write/multiedit tools in that same response and the tool results confirm success.`,
      `- If the user shows you a screenshot or describes a visual issue, you MUST read the relevant file, find the code responsible, and edit it. Do not guess — read first, then edit.`,
      ``,
      `# Tool usage policy`,
      `- You can call multiple tools in a single response. If you intend to call multiple tools and there are no dependencies between them, make all independent tool calls in parallel.`,
      `- Use specialized tools instead of bash commands when possible. For file operations, use dedicated tools: read for reading files instead of cat/head/tail, edit for editing instead of sed/awk, and write for creating files instead of cat with heredoc or echo redirection. Reserve bash exclusively for actual system commands and terminal operations.`,
      `- NEVER use bash echo or other command-line tools to communicate thoughts, explanations, or instructions to the user. Output all communication directly in your response text instead.`,
      `- When making multiple changes to the same file, use multiedit instead of multiple edit calls.`,
      ``,
      `# Code References`,
      `When referencing specific functions or pieces of code include the pattern \`file_path:line_number\` to allow the user to easily navigate to the source code location.`,
      ``,
      `# Git`,
      `- Only create commits when requested by the user. If unclear, ask first.`,
      `- NEVER update the git config.`,
      `- NEVER run destructive git commands (push --force, hard reset, etc) unless the user explicitly requests them.`,
      `- NEVER skip hooks (--no-verify) unless the user explicitly requests it.`,
      `- NEVER commit changes unless the user explicitly asks you to.`,
    ].join("\n") + skillContext
  );
}
