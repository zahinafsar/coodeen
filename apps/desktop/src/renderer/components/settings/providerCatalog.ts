export interface CatalogEntry {
  id: string;
  name: string;
  note: string;
  recommended?: boolean;
}

export const CUSTOM_ID = "__custom__";

// Curated popular list with descriptions. Mirrors opencode's hardcoded set.
// Order = display order in the "Popular" group.
export const POPULAR: CatalogEntry[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    note: "Direct access to Claude models, including Pro and Max",
    recommended: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    note: "GPT models for fast, capable general AI tasks",
  },
  {
    id: "google",
    name: "Google",
    note: "Gemini models for fast, structured responses",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    note: "Unified access to hundreds of models across providers",
  },
  {
    id: "xai",
    name: "xAI",
    note: "Grok models from xAI",
  },
  {
    id: "mistral",
    name: "Mistral",
    note: "Open-weight and frontier models from Mistral AI",
  },
  {
    id: "groq",
    name: "Groq",
    note: "Ultra-fast inference on LPU hardware",
  },
  {
    id: "deepinfra",
    name: "DeepInfra",
    note: "Serverless open-source model hosting",
  },
];

// Friendly names for non-popular IDs surfaced by opencode. Anything not listed
// here falls back to a humanised version of the id.
const NICE_NAMES: Record<string, string> = {
  azure: "Azure OpenAI",
  "amazon-bedrock": "Amazon Bedrock",
  "google-vertex": "Google Vertex",
  togetherai: "Together AI",
  cerebras: "Cerebras",
  cohere: "Cohere",
  perplexity: "Perplexity",
  vercel: "Vercel AI Gateway",
  "github-copilot": "GitHub Copilot",
  gateway: "Gateway",
  gitlab: "GitLab Duo",
  kilo: "Kilo",
  zenmux: "ZenMux",
  "cloudflare-workers-ai": "Cloudflare Workers AI",
  "cloudflare-ai-gateway": "Cloudflare AI Gateway",
  "sap-ai-core": "SAP AI Core",
};

export function displayName(id: string, fallback?: string): string {
  if (NICE_NAMES[id]) return NICE_NAMES[id];
  if (fallback) return fallback;
  return id
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

// Two-letter initials used by the avatar fallback.
export function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Deterministic color per id so the avatar feels stable.
export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${h} 55% 35%)`;
}
