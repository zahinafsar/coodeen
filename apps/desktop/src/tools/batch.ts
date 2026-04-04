import { tool } from "ai";
import { z } from "zod/v4";

const DESCRIPTION =
  "Execute multiple tool calls concurrently to reduce latency. " +
  "Pass an array of {tool, parameters} objects (1–25). All run in parallel. " +
  "Partial failures do not stop other calls. Cannot nest batch inside batch.\n\n" +
  "Good for: reading many files, grep+glob+read combos, multiple bash commands, multi-file edits.\n" +
  "Bad for: operations that depend on prior output, ordered stateful mutations.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createBatchTool = (getTools: () => Record<string, any>) =>
  tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      tool_calls: z
        .array(
          z.object({
            tool: z.string().describe("The name of the tool to execute"),
            parameters: z.record(z.string(), z.any()).describe("Parameters for the tool"),
          })
        )
        .min(1)
        .max(25)
        .describe("Array of tool calls to execute in parallel"),
    }),
    execute: async ({ tool_calls }) => {
      const tools = getTools();

      const results = await Promise.all(
        tool_calls.map(async (call) => {
          try {
            if (call.tool === "batch") {
              return { tool: call.tool, success: false, output: "Cannot nest batch inside batch" };
            }
            const t = tools[call.tool];
            if (!t) {
              return { tool: call.tool, success: false, output: `Unknown tool: ${call.tool}` };
            }
            if (!t.execute) {
              return { tool: call.tool, success: false, output: `Tool ${call.tool} has no execute function` };
            }
            const output = await t.execute(call.parameters, { toolCallId: call.tool, messages: [], abortSignal: new AbortController().signal });
            return { tool: call.tool, success: true, output };
          } catch (e) {
            return { tool: call.tool, success: false, output: e instanceof Error ? e.message : String(e) };
          }
        })
      );

      const ok = results.filter((r) => r.success).length;
      const fail = results.length - ok;

      const lines = results.map((r, i) => {
        const status = r.success ? "ok" : "FAIL";
        const out = typeof r.output === "string" ? r.output : JSON.stringify(r.output);
        return `[${i + 1}] ${r.tool} (${status}):\n${out}`;
      });

      const header = fail > 0
        ? `${ok}/${results.length} succeeded, ${fail} failed.`
        : `All ${ok} tools executed successfully.`;

      return `${header}\n\n${lines.join("\n\n")}`;
    },
  });
