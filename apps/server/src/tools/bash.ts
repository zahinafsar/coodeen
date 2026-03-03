import { tool } from "ai";
import { z } from "zod/v4";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const DEFAULT_TIMEOUT = 2 * 60 * 1000; // 2 minutes
const MAX_OUTPUT_BYTES = 100 * 1024; // 100 KB

export const createBashTool = (projectDir: string) =>
  tool({
    description:
      "Execute shell commands in the project directory. Use this to run terminal commands, build tools, tests, git commands, etc. " +
      "Returns command output (stdout + stderr). Commands timeout after 2 minutes by default.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to execute (e.g., 'npm install', 'git status', 'ls -la')"),
      workdir: z
        .string()
        .optional()
        .describe("Working directory to run the command in. Defaults to the project directory."),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds. Defaults to 120000 (2 minutes). Set to 0 for no timeout."),
      description: z
        .string()
        .describe("Clear, concise description of what this command does (5-10 words). Examples: 'Install dependencies', 'Check git status', 'Run tests'"),
    }),
    execute: async ({ command, workdir, timeout, description }) => {
      const cwd = workdir ? resolve(projectDir, workdir) : projectDir;
      const timeoutMs = timeout ?? DEFAULT_TIMEOUT;

      return new Promise<string>((resolve, reject) => {
        let output = "";
        let timedOut = false;

        // Spawn the process
        const proc = spawn(command, {
          shell: true,
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
        });

        // Collect stdout and stderr
        const handleData = (chunk: Buffer) => {
          const text = chunk.toString();
          output += text;

          // Truncate if output gets too large
          if (output.length > MAX_OUTPUT_BYTES) {
            output = output.substring(0, MAX_OUTPUT_BYTES) + "\n\n[Output truncated — exceeded 100 KB limit]";
            proc.kill();
          }
        };

        proc.stdout?.on("data", handleData);
        proc.stderr?.on("data", handleData);

        // Set timeout
        let timeoutHandle: NodeJS.Timeout | null = null;
        if (timeoutMs > 0) {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            proc.kill("SIGTERM");
          }, timeoutMs);
        }

        // Handle process exit
        proc.once("exit", (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);

          if (timedOut) {
            output += `\n\n[Command timed out after ${timeoutMs} ms]`;
          }

          if (code !== 0 && code !== null) {
            output += `\n\n[Exit code: ${code}]`;
          }

          resolve(output.trim() || "[No output]");
        });

        // Handle process error
        proc.once("error", (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(new Error(`Command failed: ${error.message}`));
        });
      });
    },
  });
