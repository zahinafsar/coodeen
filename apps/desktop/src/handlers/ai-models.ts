import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_PATH = resolve(__dirname, "../../../../models.json");
const RAW_URL =
  "https://raw.githubusercontent.com/zahinafsar/coodeen/main/models.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

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

let cached: ModelsConfig | null = null;
let cachedAt = 0;

async function readLocal(): Promise<unknown | null> {
  try {
    const text = await readFile(LOCAL_PATH, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchRemote(): Promise<unknown | null> {
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

export async function getModelsConfig(): Promise<ModelsConfig> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const raw = (await readLocal()) ?? (await fetchRemote());

  if (raw) {
    cached = raw as ModelsConfig;
    cachedAt = Date.now();
    return cached;
  }

  if (cached) return cached;
  throw new Error("Failed to load models config from local file or GitHub");
}

export async function getFreeModels(): Promise<FreeModelEntry[]> {
  const config = await getModelsConfig();
  return config.free.models;
}

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
