import { tool } from "ai";
import { z } from "zod/v4";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { truncateOutput } from "./truncation.js";

const DEFAULT_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const MAX_OUTPUT_BYTES = 100 * 1024; // 100 KB

export const createBashTool = (projectDir: string) =>
  tool({
    description:
      "Executes a given bash command with optional timeout. " +
      "IMPORTANT: This tool is for terminal operations like git, npm, docker, etc. " +
      "DO NOT use it for file operations (reading, writing, editing, searching, finding files) — use the specialized tools instead. " +
      "Use the workdir parameter to run in a different directory. AVOID using 'cd <directory> && <command>' patterns. " +
      "Avoid using bash with find, grep, cat, head, tail, sed, awk, or echo — use the dedicated tools instead: " +
      "glob (not find), grep tool (not grep/rg), read (not cat/head/tail), edit (not sed/awk), write (not echo). " +
      "When issuing multiple independent commands, make multiple bash tool calls in parallel. " +
      "If commands depend on each other, chain them with && in a single call.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to execute"),
      workdir: z
        .string()
        .optional()
        .describe("Working directory. Defaults to the project directory."),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (default: 120000). Set to 0 for no timeout."),
      description: z
        .string()
        .describe("Clear, concise description of what this command does (5-10 words)"),
    }),
    execute: async ({ command, workdir, timeout }) => {
      const cwd = workdir ? resolve(projectDir, workdir) : projectDir;
      const timeoutMs = timeout ?? DEFAULT_TIMEOUT;

      try {
        return await new Promise<string>((resolve) => {
          let output = "";
          let timedOut = false;

          const proc = spawn(command, {
            shell: true,
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env },
          });

          const handleData = (chunk: Buffer) => {
            const text = chunk.toString();
            output += text;

            if (output.length > MAX_OUTPUT_BYTES) {
              output = output.substring(0, MAX_OUTPUT_BYTES) + "\n\n[Output truncated — exceeded 100 KB limit]";
              proc.kill();
            }
          };

          proc.stdout?.on("data", handleData);
          proc.stderr?.on("data", handleData);

          let timeoutHandle: NodeJS.Timeout | null = null;
          if (timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
              timedOut = true;
              proc.kill("SIGTERM");
            }, timeoutMs);
          }

          proc.once("exit", (code) => {
            if (timeoutHandle) clearTimeout(timeoutHandle);

            if (timedOut) {
              output += `\n\n[Command timed out after ${timeoutMs} ms]`;
            }

            if (code !== 0 && code !== null) {
              output += `\n\n[Exit code: ${code}]`;
            }

            resolve(truncateOutput(output.trim() || "[No output]"));
          });

          proc.once("error", (error) => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            output += `\n\n[Process error: ${error.message}]`;
            resolve(truncateOutput(output.trim() || "[No output]"));
          });
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return `[Error executing command: ${errorMsg}]`;
      }
    },
  });
