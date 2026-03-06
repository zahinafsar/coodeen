import { Hono } from "hono";
import { execSync, spawnSync } from "node:child_process";
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
    // Don't use runGitCommand here — its trim() strips leading spaces
    // which are significant in porcelain format (position 0 = index status)
    let status = "";
    try {
      status = execSync("git status --porcelain", {
        cwd: resolvedDir,
        stdio: "pipe",
        encoding: "utf-8",
      }).trimEnd();
    } catch {}
    // Try upstream-based count first, fall back to origin/<branch> if no upstream set
    let ahead = "0";
    let behind = "0";
    try {
      ahead = execSync("git rev-list --count @{u}..HEAD", {
        cwd: resolvedDir, stdio: "pipe", encoding: "utf-8",
      }).trim();
    } catch {
      try {
        ahead = execSync(`git rev-list --count origin/${branch}..HEAD`, {
          cwd: resolvedDir, stdio: "pipe", encoding: "utf-8",
        }).trim();
      } catch {}
    }
    try {
      behind = execSync("git rev-list --count HEAD..@{u}", {
        cwd: resolvedDir, stdio: "pipe", encoding: "utf-8",
      }).trim();
    } catch {
      try {
        behind = execSync(`git rev-list --count HEAD..origin/${branch}`, {
          cwd: resolvedDir, stdio: "pipe", encoding: "utf-8",
        }).trim();
      } catch {}
    }

    const changes = status
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const file = line.substring(3);
        return {
          file,
          index: indexStatus === " " ? "" : indexStatus,
          workTree: workTreeStatus === " " ? "" : workTreeStatus,
          status: line.substring(0, 2).trim(),
        };
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

/** POST /api/git/stage — Stage files */
git.post("/stage", async (c) => {
  const body = await c.req.json<{ dir?: string; files: string[] }>();
  const dir = resolve(body.dir || process.cwd());

  if (!isGitRepo(dir)) {
    return c.json({ error: "Not a git repository" }, 400);
  }

  try {
    const fileArgs = body.files.map((f) => `"${f}"`).join(" ");
    runGitCommand(`git add -- ${fileArgs}`, dir, { throwOnError: true });
    return c.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/unstage — Unstage files */
git.post("/unstage", async (c) => {
  const body = await c.req.json<{ dir?: string; files: string[] }>();
  const dir = resolve(body.dir || process.cwd());

  if (!isGitRepo(dir)) {
    return c.json({ error: "Not a git repository" }, 400);
  }

  try {
    const fileArgs = body.files.map((f) => `"${f}"`).join(" ");
    runGitCommand(`git reset HEAD -- ${fileArgs}`, dir, { throwOnError: true });
    return c.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/commit — Commit staged changes */
git.post("/commit", async (c) => {
  const body = await c.req.json<{ dir?: string; message: string }>();
  const dir = resolve(body.dir || process.cwd());

  if (!body.message?.trim()) {
    return c.json({ error: "message is required" }, 400);
  }

  if (!isGitRepo(dir)) {
    return c.json({ error: "Not a git repository" }, 400);
  }

  try {
    // Use spawnSync with stdin to safely pass commit message (handles special chars)
    const result = spawnSync("git", ["commit", "-F", "-"], {
      cwd: dir,
      input: body.message.trim(),
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Commit failed");
    }
    return c.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/push — Push to remote */
git.post("/push", async (c) => {
  const body = await c.req.json<{ dir?: string }>();
  const dir = resolve(body.dir || process.cwd());

  if (!isGitRepo(dir)) {
    return c.json({ error: "Not a git repository" }, 400);
  }

  try {
    runGitCommand("git push", dir, { throwOnError: true });
    return c.json({ ok: true });
  } catch {
    // Fallback: set upstream if no tracking branch
    try {
      runGitCommand("git push -u origin HEAD", dir, { throwOnError: true });
      return c.json({ ok: true });
    } catch (error) {
      const err = error as Error;
      return c.json({ error: err.message }, 400);
    }
  }
});

/** POST /api/git/pull — Pull from remote */
git.post("/pull", async (c) => {
  const body = await c.req.json<{ dir?: string }>();
  const dir = resolve(body.dir || process.cwd());

  if (!isGitRepo(dir)) {
    return c.json({ error: "Not a git repository" }, 400);
  }

  try {
    runGitCommand("git pull", dir, { throwOnError: true });
    return c.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

/** POST /api/git/discard — Discard unstaged changes (revert files) */
git.post("/discard", async (c) => {
  const body = await c.req.json<{ dir?: string; files: string[] }>();
  const dir = resolve(body.dir || process.cwd());

  if (!isGitRepo(dir)) {
    return c.json({ error: "Not a git repository" }, 400);
  }

  try {
    // Separate untracked files from tracked files
    const statusRaw = execSync("git status --porcelain", {
      cwd: dir, stdio: "pipe", encoding: "utf-8",
    }).trimEnd();

    const untrackedFiles = new Set(
      statusRaw.split("\n").filter((l) => l.startsWith("??")).map((l) => l.substring(3))
    );

    const trackedFiles = body.files.filter((f) => !untrackedFiles.has(f));
    const newFiles = body.files.filter((f) => untrackedFiles.has(f));

    // Restore tracked files
    if (trackedFiles.length > 0) {
      const args = trackedFiles.map((f) => `"${f}"`).join(" ");
      runGitCommand(`git checkout -- ${args}`, dir, { throwOnError: true });
    }
    // Remove untracked files
    if (newFiles.length > 0) {
      for (const f of newFiles) {
        execSync(`rm -f "${f}"`, { cwd: dir, stdio: "pipe" });
      }
    }

    return c.json({ ok: true });
  } catch (error) {
    const err = error as Error;
    return c.json({ error: err.message }, 400);
  }
});

export { git };
