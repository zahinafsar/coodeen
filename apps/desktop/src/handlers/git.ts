import { ipcMain } from "electron";
import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

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

function runGit(
  cmd: string,
  dir: string,
  opts?: { throwOnError?: boolean },
): string {
  try {
    return execSync(cmd, {
      cwd: dir,
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();
  } catch (error) {
    if (opts?.throwOnError) throw error;
    return `Error: ${(error as Error).message}`;
  }
}

export function registerGitHandlers() {
  ipcMain.handle("git:status", async (_e, dir: string) => {
    const d = resolve(dir);
    if (!isGitRepo(d)) {
      return { error: "Not a git repository", isGitRepo: false };
    }

    const branch = runGit("git rev-parse --abbrev-ref HEAD", d);
    let status = "";
    try {
      status = execSync("git status --porcelain", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8",
      }).trimEnd();
    } catch {}

    let ahead = "0";
    let behind = "0";
    try {
      ahead = execSync("git rev-list --count @{u}..HEAD", {
        cwd: d, stdio: "pipe", encoding: "utf-8",
      }).trim();
    } catch {
      try {
        ahead = execSync(`git rev-list --count origin/${branch}..HEAD`, {
          cwd: d, stdio: "pipe", encoding: "utf-8",
        }).trim();
      } catch {}
    }
    try {
      behind = execSync("git rev-list --count HEAD..@{u}", {
        cwd: d, stdio: "pipe", encoding: "utf-8",
      }).trim();
    } catch {
      try {
        behind = execSync(`git rev-list --count HEAD..origin/${branch}`, {
          cwd: d, stdio: "pipe", encoding: "utf-8",
        }).trim();
      } catch {}
    }

    const changes = status
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => ({
        file: line.substring(3),
        index: line[0] === " " ? "" : line[0],
        workTree: line[1] === " " ? "" : line[1],
        status: line.substring(0, 2).trim(),
      }));

    const merging = runGit("git status --short", d).includes("UU");

    return {
      isGitRepo: true,
      branch,
      changes,
      ahead: parseInt(ahead) || 0,
      behind: parseInt(behind) || 0,
      isMerging: merging,
      directory: d,
    };
  });

  ipcMain.handle("git:branches", async (_e, dir: string) => {
    const d = resolve(dir);
    if (!isGitRepo(d)) {
      throw new Error("Not a git repository");
    }

    const currentBranch = runGit("git rev-parse --abbrev-ref HEAD", d);
    const branchList = runGit("git branch -a", d);

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

    return { branches, currentBranch };
  });

  ipcMain.handle("git:checkout", async (_e, dir: string, branch: string) => {
    const d = resolve(dir);
    runGit(`git checkout ${branch}`, d, { throwOnError: true });
    return { ok: true, branch };
  });

  ipcMain.handle("git:createBranch", async (_e, dir: string, branch: string) => {
    const d = resolve(dir);
    runGit(`git branch ${branch}`, d, { throwOnError: true });
    return { ok: true, branch };
  });

  ipcMain.handle(
    "git:deleteBranch",
    async (_e, dir: string, branch: string, force?: boolean) => {
      const d = resolve(dir);
      const flag = force ? "-D" : "-d";
      runGit(`git branch ${flag} ${branch}`, d, { throwOnError: true });
      return { ok: true, branch };
    },
  );

  ipcMain.handle("git:merge", async (_e, dir: string, branch: string) => {
    const d = resolve(dir);
    try {
      runGit(`git merge ${branch}`, d, { throwOnError: true });
      const newStatus = runGit("git status --short", d);
      const hasConflicts =
        newStatus.includes("UU") || newStatus.includes("AA");
      return { ok: true, merged: !hasConflicts, hasConflicts };
    } catch (error) {
      const err = error as Error;
      const hasConflicts = err.message.includes("CONFLICT");
      return { error: err.message, hasConflicts, ok: false };
    }
  });

  ipcMain.handle("git:conflicts", async (_e, dir: string) => {
    const d = resolve(dir);
    const diff = runGit(
      "git diff --name-only --diff-filter=U",
      d,
    );
    const conflicts = diff
      .split("\n")
      .filter((line) => line.trim())
      .map((file) => ({ file, type: "conflict" }));
    return { conflicts };
  });

  ipcMain.handle("git:diff", async (_e, dir: string, file?: string) => {
    const d = resolve(dir);
    const diff = file
      ? runGit(`git diff ${file}`, d)
      : runGit("git diff", d);
    return { diff };
  });

  ipcMain.handle(
    "git:stage",
    async (_e, dir: string, files: string[]) => {
      const d = resolve(dir);
      const fileArgs = files.map((f) => `"${f}"`).join(" ");
      runGit(`git add -- ${fileArgs}`, d, { throwOnError: true });
      return { ok: true };
    },
  );

  ipcMain.handle(
    "git:unstage",
    async (_e, dir: string, files: string[]) => {
      const d = resolve(dir);
      const fileArgs = files.map((f) => `"${f}"`).join(" ");
      runGit(`git reset HEAD -- ${fileArgs}`, d, { throwOnError: true });
      return { ok: true };
    },
  );

  ipcMain.handle(
    "git:commit",
    async (_e, dir: string, message: string) => {
      const d = resolve(dir);
      const result = spawnSync("git", ["commit", "-F", "-"], {
        cwd: d,
        input: message.trim(),
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf-8",
      });
      if (result.status !== 0) {
        throw new Error(
          result.stderr || result.stdout || "Commit failed",
        );
      }
      return { ok: true };
    },
  );

  ipcMain.handle("git:push", async (_e, dir: string) => {
    const d = resolve(dir);
    try {
      runGit("git push", d, { throwOnError: true });
      return { ok: true };
    } catch {
      runGit("git push -u origin HEAD", d, { throwOnError: true });
      return { ok: true };
    }
  });

  ipcMain.handle("git:pull", async (_e, dir: string) => {
    const d = resolve(dir);
    runGit("git pull", d, { throwOnError: true });
    return { ok: true };
  });

  ipcMain.handle(
    "git:discard",
    async (_e, dir: string, files: string[]) => {
      const d = resolve(dir);
      const statusRaw = execSync("git status --porcelain", {
        cwd: d,
        stdio: "pipe",
        encoding: "utf-8",
      }).trimEnd();

      const untrackedFiles = new Set(
        statusRaw
          .split("\n")
          .filter((l) => l.startsWith("??"))
          .map((l) => l.substring(3)),
      );

      const trackedFiles = files.filter((f) => !untrackedFiles.has(f));
      const newFiles = files.filter((f) => untrackedFiles.has(f));

      if (trackedFiles.length > 0) {
        const args = trackedFiles.map((f) => `"${f}"`).join(" ");
        runGit(`git checkout -- ${args}`, d, { throwOnError: true });
      }
      if (newFiles.length > 0) {
        for (const f of newFiles) {
          execSync(`rm -f "${f}"`, { cwd: d, stdio: "pipe" });
        }
      }

      return { ok: true };
    },
  );
}
