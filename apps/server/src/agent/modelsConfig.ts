/**
 * Loads models.json — local file first, GitHub remote as fallback.
 * Caches in memory — refreshes every 5 minutes.
 */

import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_PATH = resolve(__dirname, "../../../../models.json");
const RAW_URL =
  "https://raw.githubusercontent.com/zahinafsar/coodeen/main/models.json";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ModelEntry {
  id: string;
  input: string[];
}

export interface FreeModelEntry {
  id: string;
  name: string;
  input: string[];
}

export interface ModelsConfig {
  providers: Record<string, { label: string; models: ModelEntry[] }>;
  free: {
    provider: string;
    label: string;
    baseURL: string;
    models: FreeModelEntry[];
  };
}

/** Check if a model supports image input based on config. Defaults to false if not found. */
export async function modelSupportsImage(
  providerId: string,
  modelId: string,
): Promise<boolean> {
  const config = await getModelsConfig();

  if (providerId === config.free.provider) {
    const entry = config.free.models.find((m) => m.id === modelId);
    return entry?.input?.includes("image") ?? false;
  }

  const provider = config.providers[providerId];
  if (!provider) return false;

  const entry = provider.models.find((m) => m.id === modelId);
  return entry?.input?.includes("image") ?? false;
}

let cached: ModelsConfig | null = null;
let cachedAt = 0;

/** Cast raw JSON to typed ModelsConfig. */
function normalize(raw: any): ModelsConfig {
  return raw as ModelsConfig;
}

/** Try reading the local models.json file */
async function readLocal(): Promise<any | null> {
  try {
    const text = await readFile(LOCAL_PATH, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Try fetching models.json from GitHub */
async function fetchRemote(): Promise<any | null> {
  try {
    const res = await fetch(RAW_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Load and return the models config. Local file first, GitHub fallback. Caches for 5 min. */
export async function getModelsConfig(): Promise<ModelsConfig> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const raw = (await readLocal()) ?? (await fetchRemote());

  if (raw) {
    const data = normalize(raw);
    cached = data;
    cachedAt = Date.now();
    return data;
  }

  if (cached) return cached;
  throw new Error("Failed to load models config from local file or GitHub");
}
