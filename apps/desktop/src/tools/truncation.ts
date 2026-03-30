const MAX_LINES = 2000;
const MAX_BYTES = 50 * 1024; // 50 KB

/**
 * Truncate tool output to prevent context window blowup.
 * Caps at 2000 lines or 50KB, whichever is hit first.
 * Copied from OpenCode's truncation approach.
 */
export function truncateOutput(text: string): string {
  const lines = text.split("\n");
  const totalBytes = Buffer.byteLength(text, "utf-8");

  if (lines.length <= MAX_LINES && totalBytes <= MAX_BYTES) {
    return text;
  }

  const out: string[] = [];
  let bytes = 0;

  for (let i = 0; i < lines.length && i < MAX_LINES; i++) {
    const size = Buffer.byteLength(lines[i], "utf-8") + (i > 0 ? 1 : 0);
    if (bytes + size > MAX_BYTES) break;
    out.push(lines[i]);
    bytes += size;
  }

  const removedLines = lines.length - out.length;
  const removedBytes = totalBytes - bytes;

  return (
    out.join("\n") +
    `\n\n...${removedLines} lines / ${removedBytes} bytes truncated...\n` +
    `Use read with offset/limit to view specific sections, or grep to search the full content.`
  );
}
