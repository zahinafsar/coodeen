/* eslint-disable no-undef */
/* eslint-env node */

/**
 * Rebuilds native Node modules against Electron's Node headers.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = ["better-sqlite3"];

const { version } = JSON.parse(
  readFileSync(resolve(root, "node_modules/electron/package.json"), "utf8")
);

const flags = `--target=${version} --arch=${process.arch} --dist-url=https://electronjs.org/headers --runtime=electron`;

console.log(`Rebuilding native modules for Electron ${version} (${process.arch})\n`);

for (const mod of modules) {
  const dir = resolve(root, "node_modules", mod);
  if (!existsSync(resolve(dir, "binding.gyp"))) {
    console.log(`  [skip] ${mod}`);
    continue;
  }
  console.log(`  [build] ${mod}`);
  execSync(`npx node-gyp rebuild ${flags}`, { cwd: dir, stdio: "pipe" });
  console.log(`  [done]  ${mod}`);
}

console.log("\nDone.");
