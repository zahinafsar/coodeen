/**
 * Copies only the runtime-required node_modules from monorepo root
 * into apps/desktop/node_modules for electron-builder packaging.
 *
 * Only main process dependencies are needed — the renderer is fully
 * bundled by Vite. This list comes from `require()` calls in out/main/index.js.
 */

import { cpSync, existsSync, mkdirSync, lstatSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootModules = resolve(root, "node_modules");
const targetModules = resolve(root, "apps/desktop/node_modules");

// Only packages actually require()'d by the main process at runtime
// Node built-ins (fs, path, os, crypto, child_process, url) are excluded
const RUNTIME_DEPS = [
  "better-sqlite3",
  "drizzle-orm",
  "ai",
  "@ai-sdk/anthropic",
  "@ai-sdk/openai",
  "@ai-sdk/google",
  "@ai-sdk/openai-compatible",
  "@lydell/node-pty",
  "zod",
  "fast-glob",
];

// Recursively collect all transitive dependencies
function collectDeps(name, collected = new Set()) {
  if (collected.has(name)) return collected;
  collected.add(name);

  const pkgPath = resolve(rootModules, name, "package.json");
  if (!existsSync(pkgPath)) return collected;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    for (const dep of Object.keys(pkg.dependencies || {})) {
      collectDeps(dep, collected);
    }
  } catch {
    // ignore
  }
  return collected;
}

// Collect all deps including transitive
const allDeps = new Set();
for (const dep of RUNTIME_DEPS) {
  collectDeps(dep, allDeps);
}

console.log(`Copying ${allDeps.size} packages (${RUNTIME_DEPS.length} direct + ${allDeps.size - RUNTIME_DEPS.length} transitive)\n`);

mkdirSync(targetModules, { recursive: true });

let copied = 0;
let skipped = 0;

for (const name of allDeps) {
  const src = resolve(rootModules, name);
  const dest = resolve(targetModules, name);

  if (!existsSync(src)) {
    skipped++;
    continue;
  }

  // Skip workspace symlinks
  try {
    if (lstatSync(src).isSymbolicLink()) {
      skipped++;
      continue;
    }
  } catch {
    // ignore
  }

  // Ensure scoped package parent dir exists
  if (name.startsWith("@")) {
    mkdirSync(resolve(targetModules, name.split("/")[0]), { recursive: true });
  }

  cpSync(src, dest, { recursive: true, dereference: true });
  copied++;
}

// Clean up unnecessary files from copied modules to reduce size
const CLEANUP_PATTERNS = [
  // better-sqlite3: remove C++ source, build artifacts not needed at runtime
  "better-sqlite3/deps",
  "better-sqlite3/src",
  // drizzle-orm: remove unused database dialects
  "drizzle-orm/pg-core",
  "drizzle-orm/mysql-core",
  "drizzle-orm/mysql2",
  "drizzle-orm/postgres-js",
  "drizzle-orm/neon-serverless",
  "drizzle-orm/neon-http",
  "drizzle-orm/planetscale-serverless",
  "drizzle-orm/libsql",
  "drizzle-orm/d1",
  "drizzle-orm/bun-sqlite",
  "drizzle-orm/sql-js",
  "drizzle-orm/op-sqlite",
  "drizzle-orm/expo-sqlite",
  "drizzle-orm/vercel-postgres",
  "drizzle-orm/xata-http",
  "drizzle-orm/tidb-serverless",
  "drizzle-orm/aws-data-api",
  "drizzle-orm/gel-core",
  "drizzle-orm/singlestore-core",
  "drizzle-orm/monodriver",
  "drizzle-orm/migrator",
];

import { rmSync } from "fs";

for (const pattern of CLEANUP_PATTERNS) {
  const target = resolve(targetModules, pattern);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
}

console.log(`Copied ${copied}, skipped ${skipped}.`);

// Report size
import { execSync } from "child_process";
const size = execSync(`du -sh ${targetModules}`).toString().trim().split("\t")[0];
console.log(`Total node_modules size: ${size}`);
