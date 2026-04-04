import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { providerDb } from "../db/providers.js";
import { getModelsConfig } from "./ai-models.js";

export type ResolvedProvider = {
  model: LanguageModel;
  providerId: string;
  modelId: string;
};

export type ResolveError = {
  error: string;
};

export async function resolveProvider(
  providerId: string,
  modelId: string,
): Promise<ResolvedProvider | ResolveError> {
  // Free models via OpenCode Zen
  if (providerId === "opencode") {
    const config = await getModelsConfig();
    const zen = createOpenAICompatible({
      name: config.free.provider,
      baseURL: config.free.baseURL,
      apiKey: "public",
    });
    const model = zen.chatModel(modelId);
    return { model, providerId, modelId };
  }

  const providerRow = providerDb.get(providerId);

  if (!providerRow) {
    return {
      error: `Provider '${providerId}' not configured. Go to Settings.`,
    };
  }

  if (!providerRow.apiKey) {
    return {
      error: `API key not configured for ${providerId}. Go to Settings.`,
    };
  }

  const { apiKey } = providerRow;
  let model: LanguageModel;

  switch (providerId) {
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      model = anthropic(modelId);
      break;
    }
    case "openai": {
      const openai = createOpenAI({ apiKey });
      model = openai(modelId);
      break;
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(modelId);
      break;
    }
    default:
      return { error: `Unsupported provider: ${providerId}` };
  }

  return { model, providerId, modelId };
}

export function isResolveError(
  result: ResolvedProvider | ResolveError,
): result is ResolveError {
  return "error" in result;
}
