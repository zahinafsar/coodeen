import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, dirname, relative } from "node:path";
import { readFile, writeFile, mkdir, unlink, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";

// ── Patch types ──────────────────────────────────────────────────────────────

type Hunk =
  | { type: "add"; path: string; contents: string }
  | { type: "delete"; path: string }
  | { type: "update"; path: string; move_path?: string; chunks: UpdateFileChunk[] };

interface UpdateFileChunk {
  old_lines: string[];
  new_lines: string[];
  change_context?: string;
  is_end_of_file?: boolean;
}

// ── Parser ───────────────────────────────────────────────────────────────────

function stripHeredoc(input: string): string {
  const m = input.match(/^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/);
  return m ? m[2] : input;
}

function parsePatch(patchText: string): Hunk[] {
  const lines = stripHeredoc(patchText.trim()).split("\n");
  const beginIdx = lines.findIndex((l) => l.trim() === "*** Begin Patch");
  const endIdx = lines.findIndex((l) => l.trim() === "*** End Patch");

  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
    throw new Error("Invalid patch format: missing Begin/End markers");
  }

  const hunks: Hunk[] = [];
  let i = beginIdx + 1;

  while (i < endIdx) {
    const line = lines[i];

    if (line.startsWith("*** Add File:")) {
      const filePath = line.slice("*** Add File:".length).trim();
      i++;
      let content = "";
      while (i < endIdx && !lines[i].startsWith("***")) {
        if (lines[i].startsWith("+")) content += lines[i].substring(1) + "\n";
        i++;
      }
      if (content.endsWith("\n")) content = content.slice(0, -1);
      hunks.push({ type: "add", path: filePath, contents: content });
    } else if (line.startsWith("*** Delete File:")) {
      hunks.push({ type: "delete", path: line.slice("*** Delete File:".length).trim() });
      i++;
    } else if (line.startsWith("*** Update File:")) {
      const filePath = line.slice("*** Update File:".length).trim();
      i++;
      let movePath: string | undefined;
      if (i < endIdx && lines[i].startsWith("*** Move to:")) {
        movePath = lines[i].slice("*** Move to:".length).trim();
        i++;
      }
      const chunks: UpdateFileChunk[] = [];
      while (i < endIdx && !lines[i].startsWith("***")) {
        if (lines[i].startsWith("@@")) {
          const changeContext = lines[i].substring(2).trim() || undefined;
          i++;
          const oldLines: string[] = [];
          const newLines: string[] = [];
          let isEndOfFile = false;
          while (i < endIdx && !lines[i].startsWith("@@") && !lines[i].startsWith("***")) {
            if (lines[i] === "*** End of File") { isEndOfFile = true; i++; break; }
            if (lines[i].startsWith(" ")) { const c = lines[i].substring(1); oldLines.push(c); newLines.push(c); }
            else if (lines[i].startsWith("-")) oldLines.push(lines[i].substring(1));
            else if (lines[i].startsWith("+")) newLines.push(lines[i].substring(1));
            i++;
          }
          chunks.push({ old_lines: oldLines, new_lines: newLines, change_context: changeContext, is_end_of_file: isEndOfFile || undefined });
        } else {
          i++;
        }
      }
      hunks.push({ type: "update", path: filePath, move_path: movePath, chunks });
    } else {
      i++;
    }
  }

  return hunks;
}

// ── Chunk application ────────────────────────────────────────────────────────

function normalizeUnicode(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

type Cmp = (a: string, b: string) => boolean;

function tryMatch(lines: string[], pattern: string[], start: number, cmp: Cmp, eof: boolean): number {
  if (eof) {
    const fromEnd = lines.length - pattern.length;
    if (fromEnd >= start && pattern.every((p, j) => cmp(lines[fromEnd + j], p))) return fromEnd;
  }
  for (let i = start; i <= lines.length - pattern.length; i++) {
    if (pattern.every((p, j) => cmp(lines[i + j], p))) return i;
  }
  return -1;
}

function seekSequence(lines: string[], pattern: string[], start: number, eof = false): number {
  if (!pattern.length) return -1;
  let r = tryMatch(lines, pattern, start, (a, b) => a === b, eof);
  if (r !== -1) return r;
  r = tryMatch(lines, pattern, start, (a, b) => a.trimEnd() === b.trimEnd(), eof);
  if (r !== -1) return r;
  r = tryMatch(lines, pattern, start, (a, b) => a.trim() === b.trim(), eof);
  if (r !== -1) return r;
  return tryMatch(lines, pattern, start, (a, b) => normalizeUnicode(a.trim()) === normalizeUnicode(b.trim()), eof);
}

function deriveNewContents(filePath: string, chunks: UpdateFileChunk[]): string {
  let lines = readFileSync(filePath, "utf-8").split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  const replacements: Array<[number, number, string[]]> = [];
  let idx = 0;

  for (const chunk of chunks) {
    if (chunk.change_context) {
      const ci = seekSequence(lines, [chunk.change_context], idx);
      if (ci === -1) throw new Error(`Context '${chunk.change_context}' not found in ${filePath}`);
      idx = ci + 1;
    }
    if (chunk.old_lines.length === 0) {
      const ins = lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
      replacements.push([ins, 0, chunk.new_lines]);
      continue;
    }
    let pattern = chunk.old_lines;
    let newSlice = chunk.new_lines;
    let found = seekSequence(lines, pattern, idx, chunk.is_end_of_file);
    if (found === -1 && pattern.length > 0 && pattern[pattern.length - 1] === "") {
      pattern = pattern.slice(0, -1);
      if (newSlice.length > 0 && newSlice[newSlice.length - 1] === "") newSlice = newSlice.slice(0, -1);
      found = seekSequence(lines, pattern, idx, chunk.is_end_of_file);
    }
    if (found === -1) throw new Error(`Failed to find expected lines in ${filePath}:\n${chunk.old_lines.join("\n")}`);
    replacements.push([found, pattern.length, newSlice]);
    idx = found + pattern.length;
  }

  replacements.sort((a, b) => a[0] - b[0]);
  const result = [...lines];
  for (let i = replacements.length - 1; i >= 0; i--) {
    const [start, len, seg] = replacements[i];
    result.splice(start, len, ...seg);
  }
  if (result.length === 0 || result[result.length - 1] !== "") result.push("");
  return result.join("\n");
}

// ── Tool definition ──────────────────────────────────────────────────────────

const DESCRIPTION =
  "Apply a patch to create, update, delete, or move files. " +
  "The patch format uses *** Begin Patch / *** End Patch markers with file sections:\n" +
  "*** Add File: <path> — new file, every line prefixed with +\n" +
  "*** Delete File: <path> — remove a file\n" +
  "*** Update File: <path> — edit in place with @@ context and +/- lines\n" +
  "*** Move to: <path> — rename (after Update File header)\n\n" +
  "Example:\n" +
  "*** Begin Patch\n" +
  "*** Add File: hello.txt\n" +
  "+Hello world\n" +
  "*** Update File: src/app.py\n" +
  "@@ def greet():\n" +
  '-print("Hi")\n' +
  '+print("Hello, world!")\n' +
  "*** Delete File: obsolete.txt\n" +
  "*** End Patch\n\n" +
  "Prefer this over edit/multiedit for multi-file changes.";

export const createApplyPatchTool = (projectDir: string) =>
  tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      patchText: z.string().describe("The full patch text with Begin/End markers"),
    }),
    execute: async ({ patchText }) => {
      let hunks: Hunk[];
      try {
        hunks = parsePatch(patchText);
      } catch (e) {
        return `[Error parsing patch: ${e instanceof Error ? e.message : e}]`;
      }

      if (hunks.length === 0) return "[Error: patch contains no file operations]";

      const summary: string[] = [];

      for (const hunk of hunks) {
        const filePath = resolve(projectDir, hunk.path);

        try {
          switch (hunk.type) {
            case "add": {
              await mkdir(dirname(filePath), { recursive: true });
              const content = hunk.contents.endsWith("\n") ? hunk.contents : hunk.contents + "\n";
              await writeFile(filePath, content, "utf-8");
              summary.push(`A ${relative(projectDir, filePath)}`);
              break;
            }
            case "delete": {
              await unlink(filePath);
              summary.push(`D ${relative(projectDir, filePath)}`);
              break;
            }
            case "update": {
              const s = await stat(filePath).catch(() => null);
              if (!s || s.isDirectory()) return `[Error: cannot update ${hunk.path} — file not found]`;

              const newContent = deriveNewContents(filePath, hunk.chunks);
              const target = hunk.move_path ? resolve(projectDir, hunk.move_path) : filePath;

              if (hunk.move_path) {
                await mkdir(dirname(target), { recursive: true });
                await writeFile(target, newContent, "utf-8");
                await unlink(filePath);
                summary.push(`M ${relative(projectDir, target)} (moved from ${relative(projectDir, filePath)})`);
              } else {
                await writeFile(filePath, newContent, "utf-8");
                summary.push(`M ${relative(projectDir, filePath)}`);
              }
              break;
            }
          }
        } catch (e) {
          return `[Error applying hunk for ${hunk.path}: ${e instanceof Error ? e.message : e}]`;
        }
      }

      return `Patch applied successfully:\n${summary.join("\n")}`;
    },
  });
