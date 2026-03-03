import { Hono } from "hono";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const git = new Hono();

interface GitError {
  error: string;
  code?: string;
}

function isGitRepo(dir: string): boolean {
  try {
    execSync("git rev-parse --git-dir", {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

function runGitCommand(
  cmd: string,
  dir: string,
  options?: { throwOnError?: boolean }
): string {
  try {
    const result = execSync(cmd, {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8",
    });
    return result.trim();
  } catch (error) {
    if (options?.throwOnError) throw error;
    const err = error as Error;
    return `Error: ${err.message}`;
  }
}

/** GET /api/git/status — Get git status for a directory */
git.get("/status", async (c) => {
  const dir = c.req.query("dir") || process.cwd();
  const resolvedDir = resolve(dir);

  if (!isGitRepo(resolvedDir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    const branch = runGitCommand("git rev-parse --abbrev-ref HEAD", resolvedDir);
    const status = runGitCommand("git status --porcelain", resolvedDir);
    const ahead = runGitCommand(
      "git rev-list --count @{u}..HEAD",
      resolvedDir
    );
    const behind = runGitCommand(
      "git rev-list --count HEAD..@{u}",
      resolvedDir
    );

    const changes = status
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        return { status: status.trim(), file };
      });

    const merging = runGitCommand("git status --short", resolvedDir).includes(
      "UU"
    );

    return c.json({
      isGitRepo: true,
      branch,
      changes,
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0,
      isMerging: merging,
      directory: resolvedDir,
    });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 500);
  }
});

/** GET /api/git/branches — List all branches */
git.get("/branches", async (c) => {
  const dir = c.req.query("dir") || process.cwd();
  const resolvedDir = resolve(dir);

  if (!isGitRepo(resolvedDir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    const currentBranch = runGitCommand(
      "git rev-parse --abbrev-ref HEAD",
      resolvedDir
    );
    const branchList = runGitCommand("git branch -a", resolvedDir);

    const branches = branchList
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const isRemote = trimmed.startsWith("remotes/");
        const isCurrent = trimmed.startsWith("*");
        const name = trimmed.replace(/^\*\s+/, "").replace(/^remotes\//, "");
        return {
          name,
          isCurrent: isCurrent || name === currentBranch,
          isRemote,
          fullRef: trimmed.replace("* ", ""),
        };
      })
      .filter(Boolean);

    return c.json({ branches, currentBranch });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 500);
  }
});

/** POST /api/git/checkout — Switch to a branch */
git.post("/checkout", async (c) => {
  const body = await c.req.json<{ dir?: string; branch: string }>();
  const dir = resolve(body.dir || process.cwd());
  const { branch } = body;

  if (!branch) {
    return c.json({ error: "branch is required" }, 400);
  }

  if (!isGitRepo(dir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    runGitCommand(`git checkout ${branch}`, dir, { throwOnError: true });
    return c.json({ ok: true, branch });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/create-branch — Create a new branch */
git.post("/create-branch", async (c) => {
  const body = await c.req.json<{ dir?: string; branch: string }>();
  const dir = resolve(body.dir || process.cwd());
  const { branch } = body;

  if (!branch) {
    return c.json({ error: "branch is required" }, 400);
  }

  if (!isGitRepo(dir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    runGitCommand(`git branch ${branch}`, dir, { throwOnError: true });
    return c.json({ ok: true, branch });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/delete-branch — Delete a branch */
git.post("/delete-branch", async (c) => {
  const body = await c.req.json<{ dir?: string; branch: string; force?: boolean }>();
  const dir = resolve(body.dir || process.cwd());
  const { branch, force } = body;

  if (!branch) {
    return c.json({ error: "branch is required" }, 400);
  }

  if (!isGitRepo(dir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    const flag = force ? "-D" : "-d";
    runGitCommand(`git branch ${flag} ${branch}`, dir, { throwOnError: true });
    return c.json({ ok: true, branch });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/merge — Merge a branch */
git.post("/merge", async (c) => {
  const body = await c.req.json<{ dir?: string; branch: string }>();
  const dir = resolve(body.dir || process.cwd());
  const { branch } = body;

  if (!branch) {
    return c.json({ error: "branch is required" }, 400);
  }

  if (!isGitRepo(dir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    runGitCommand(`git merge ${branch}`, dir, { throwOnError: true });
    const newStatus = runGitCommand("git status --short", dir);
    const hasConflicts = newStatus.includes("UU") || newStatus.includes("AA");

    return c.json({ ok: true, merged: !hasConflicts, hasConflicts });
  } catch (error) {
    const err = error as Error;
    const hasConflicts = err.message.includes("CONFLICT");
    return c.json(
      { error: err.message, hasConflicts, ok: false },
      hasConflicts ? 200 : 400
    );
  }
});

/** GET /api/git/conflicts — Get merge conflicts */
git.get("/conflicts", async (c) => {
  const dir = c.req.query("dir") || process.cwd();
  const resolvedDir = resolve(dir);

  if (!isGitRepo(resolvedDir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    const diff = runGitCommand("git diff --name-only --diff-filter=U", resolvedDir);
    const conflicts = diff
      .split("\n")
      .filter((line) => line.trim())
      .map((file) => ({
        file,
        type: "conflict",
      }));

    return c.json({ conflicts });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 500);
  }
});

/** GET /api/git/diff — Get diff for files */
git.get("/diff", async (c) => {
  const dir = c.req.query("dir") || process.cwd();
  const file = c.req.query("file");
  const resolvedDir = resolve(dir);

  if (!isGitRepo(resolvedDir)) {
    return c.json(
      { error: "Not a git repository", isGitRepo: false },
      400
    );
  }

  try {
    let diff: string;
    if (file) {
      diff = runGitCommand(`git diff ${file}`, resolvedDir);
    } else {
      diff = runGitCommand("git diff", resolvedDir);
    }

    return c.json({ diff });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 500);
  }
});

export { git };
