#!/usr/bin/env node
/* eslint-disable no-console */
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync, createWriteStream, rmSync, renameSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir, arch as osArch, platform as osPlatform } from "node:os";

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));
const BIN_DIR = join(ROOT, "apps/desktop/resources/bin");
const VERSION_FILE = join(BIN_DIR, ".opencode-version");
const REPO = "sst/opencode";
const PINNED = process.env.OPENCODE_VERSION || "latest";

function assetName(platform, arch) {
  const key = `${platform}-${arch}`;
  const map = {
    "darwin-arm64": { file: "opencode-darwin-arm64.zip", ext: "zip" },
    "darwin-x64":   { file: "opencode-darwin-x64.zip",   ext: "zip" },
    "linux-arm64":  { file: "opencode-linux-arm64.tar.gz", ext: "tar.gz" },
    "linux-x64":    { file: "opencode-linux-x64.tar.gz",   ext: "tar.gz" },
    "win32-x64":    { file: "opencode-windows-x64.zip",    ext: "zip" },
    "win32-arm64":  { file: "opencode-windows-arm64.zip",  ext: "zip" },
  };
  const hit = map[key];
  if (!hit) throw new Error(`Unsupported platform/arch: ${key}`);
  return hit;
}

function mapArch(a) {
  if (a === "x64") return "x64";
  if (a === "arm64") return "arm64";
  throw new Error(`Unsupported arch: ${a}`);
}

async function resolveVersion() {
  if (PINNED !== "latest") return PINNED.startsWith("v") ? PINNED : `v${PINNED}`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { "user-agent": "coodeen-fetch-opencode" },
  });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.tag_name;
}

async function download(url, dest) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "coodeen-fetch-opencode" } });
  if (!r.ok) throw new Error(`Download ${r.status}: ${url}`);
  const ws = createWriteStream(dest);
  await new Promise((resolve, reject) => {
    r.body.pipeTo(
      new WritableStream({
        write(chunk) { ws.write(chunk); },
        close() { ws.end(resolve); },
        abort(err) { ws.destroy(err); reject(err); },
      }),
    ).catch(reject);
  });
}

function extract(archive, ext, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  if (ext === "zip") {
    const r = spawnSync("unzip", ["-o", archive, "-d", outDir], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("unzip failed");
  } else if (ext === "tar.gz") {
    const r = spawnSync("tar", ["-xzf", archive, "-C", outDir], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("tar failed");
  } else {
    throw new Error(`Unknown archive ext: ${ext}`);
  }
}

function findBinary(dir, name) {
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      const s = statSync(p);
      if (s.isDirectory()) {
        const hit = walk(p);
        if (hit) return hit;
      } else if (entry === name || entry === `${name}.exe`) {
        return p;
      }
    }
    return null;
  };
  return walk(dir);
}

async function main() {
  const platform = osPlatform();
  const arch = mapArch(osArch());
  const { file, ext } = assetName(platform, arch);

  const version = await resolveVersion();
  const existing = existsSync(VERSION_FILE) ? readFileSync(VERSION_FILE, "utf8").trim() : "";
  const binName = platform === "win32" ? "opencode.exe" : "opencode";
  const binPath = join(BIN_DIR, binName);

  if (existing === version && existsSync(binPath)) {
    console.log(`opencode ${version} already present at ${binPath}`);
    return;
  }

  console.log(`Fetching opencode ${version} for ${platform}-${arch}...`);
  mkdirSync(BIN_DIR, { recursive: true });

  const url = `https://github.com/${REPO}/releases/download/${version}/${file}`;
  const tmp = join(tmpdir(), `opencode-${version}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const archive = join(tmp, file);

  await download(url, archive);
  const extractDir = join(tmp, "extract");
  extract(archive, ext, extractDir);

  const found = findBinary(extractDir, "opencode");
  if (!found) throw new Error(`Binary not found in archive at ${extractDir}`);
  renameSync(found, binPath);
  if (platform !== "win32") chmodSync(binPath, 0o755);

  writeFileSync(VERSION_FILE, version);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Installed opencode ${version} → ${binPath}`);
}

main().catch((e) => {
  console.error("[fetch-opencode] failed:", e.message || e);
  process.exit(1);
});
