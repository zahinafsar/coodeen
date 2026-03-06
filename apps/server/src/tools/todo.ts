import { tool } from "ai";
import { z } from "zod/v4";

// In-memory per-session todo storage
const sessionTodos = new Map<string, Array<{ content: string; status: string }>>();

export const createTodoWriteTool = (sessionId: string) =>
  tool({
    description:
      "Create and manage a task list for the current session. " +
      "Use proactively for complex multi-step tasks (3+ steps). " +
      "Helps track progress and shows the user what you're working on. " +
      "Skip for single, trivial tasks.",
    inputSchema: z.object({
      todos: z
        .array(
          z.object({
            content: z.string().describe("Task description"),
            status: z
              .enum(["pending", "in_progress", "completed"])
              .describe("Task status"),
          })
        )
        .describe("The full updated todo list"),
    }),
    execute: async ({ todos }) => {
      sessionTodos.set(sessionId, todos);
      const pending = todos.filter((t) => t.status === "pending").length;
      const inProgress = todos.filter((t) => t.status === "in_progress").length;
      const completed = todos.filter((t) => t.status === "completed").length;
      return `Todo list updated: ${completed} done, ${inProgress} in progress, ${pending} pending`;
    },
  });

export const createTodoReadTool = (sessionId: string) =>
  tool({
    description:
      "Read the current task list for this session. " +
      "Use to check progress, plan next steps, or review remaining work.",
    inputSchema: z.object({}),
    execute: async () => {
      const todos = sessionTodos.get(sessionId) || [];
      if (todos.length === 0) return "No todos yet.";
      return todos
        .map((t, i) => `${i + 1}. [${t.status}] ${t.content}`)
        .join("\n");
    },
  });
