import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const providerId = "__NAME__";
const baseUrlEnv = "__ENV_PREFIX__BASE_URL";
const apiKeyEnv = "__ENV_PREFIX__API_KEY";

function modelFromCatalog(raw: any) {
  if (!raw || typeof raw.id !== "string" || /[\x00-\x1f]/.test(raw.id)) return null;
  const capabilities = raw.capabilities ?? {};
  if (capabilities.tools === false) return null;
  const model: any = {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : raw.id,
    reasoning: capabilities.reasoning === true,
    input: capabilities.vision === true ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: Number.isInteger(raw.context_length) ? raw.context_length : 128000,
    maxTokens: Number.isInteger(raw.max_completion_tokens) ? raw.max_completion_tokens : 8192,
  };
  if (capabilities.reasoning === true) model.thinkingLevelMap = { minimal: "low", low: "low", medium: "medium", high: "high" };
  return model;
}

function config(env = process.env) {
  const baseUrl = env[baseUrlEnv];
  const apiKey = env[apiKeyEnv];
  if (!baseUrl || !apiKey) throw new Error(`${baseUrlEnv} and ${apiKeyEnv} are required`);
  const url = new URL(baseUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Provider URL must use HTTP(S)");
  return { baseUrl: url.href.replace(/\/$/, ""), apiKey };
}

export default function (pi: ExtensionAPI) {
  pi.registerProvider(providerId, {
    name: "__DISPLAY_NAME__",
    api: "openai-responses",
    baseUrl: `$${baseUrlEnv}`,
    apiKey: `$${apiKeyEnv}`,
    models: [],
    refreshModels: async (context: any) => {
      const { baseUrl, apiKey } = config();
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey },
        redirect: "error",
        signal: context.signal,
      });
      if (!response.ok) throw new Error(`Model catalog failed with HTTP ${response.status}`);
      const payload = await response.json();
      const models = Array.isArray(payload?.data)
        ? payload.data.map(modelFromCatalog).filter(Boolean)
        : [];
      if (!models.length) throw new Error("Provider returned an empty model catalog");
      return models;
    },
  });
}
