import { workbenchPaths } from "../scripts/workbench-paths.mjs";
import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";
import fs from "node:fs";
import { routerRoleEvent } from "../scripts/router-role.mjs";

type Complexity = "simple" | "moderate" | "complex";
type Capability = "planning" | "coding" | "debugging" | "review" | "qa" | "testing" | "security";
type Requirements = {
  reasoning: boolean;
  tools: boolean;
  vision: boolean;
  contextWindowMin: number;
  capability: Capability;
};

type RouterState = { provider: string; id: string; complexity?: Complexity; failedModels?: string[] };
type RouterRequest = ModelRouteRequest<RouterState>;

const ROUTER_PROVIDER = "router";
const ROLE_ENV = "PI_ROUTER_ROLE";
const PROVIDER_ENV = "PI_ROUTER_PROVIDER";
const MODEL_ENV = "PI_ROUTER_MODEL";
const TRACE_ENV = "PI_ROUTER_TRACE";
const COMPLEXITY_ENV = "PI_ROUTER_COMPLEXITY";
const COMPLEXITIES = new Set<Complexity>(["simple", "moderate", "complex"]);
const DEFAULT_REQUIREMENTS: Requirements = { reasoning: false, tools: true, vision: false, contextWindowMin: 64_000, capability: "coding" };
// The environment supplies the initial role; explicit session changes take precedence.
let activeRole = process.env[ROLE_ENV] ?? "default";
let activeComplexity: Complexity = COMPLEXITIES.has(process.env[COMPLEXITY_ENV] as Complexity) ? process.env[COMPLEXITY_ENV] as Complexity : "moderate";
export function setRouterRole(role: string, complexity?: string) {
  if (!Object.hasOwn(ROLE_REQUIREMENTS, role)) throw new Error(`Unknown router role: ${role}`);
  if (complexity !== undefined && !COMPLEXITIES.has(complexity as Complexity)) throw new Error(`Unknown router complexity: ${complexity}`);
  activeRole = role;
  if (complexity !== undefined) activeComplexity = complexity as Complexity;
}
export function getRouterComplexity() {
  return activeComplexity;
}
export function getRouterRole() {
  if (!Object.hasOwn(ROLE_REQUIREMENTS, activeRole)) throw new Error(`Unknown router role: ${activeRole}`);
  return activeRole;
}

const ROLE_REQUIREMENTS: Record<string, Requirements> = {
  default: DEFAULT_REQUIREMENTS,
  think: { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000, capability: "planning" },
  // tools:false means tool support is not required; it does not restrict tool permissions.
  "think-advisor": { reasoning: true, tools: false, vision: false, contextWindowMin: 100_000, capability: "planning" },
  "planner": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000, capability: "planning" },
  "developer": { reasoning: false, tools: true, vision: false, contextWindowMin: 64_000, capability: "coding" },
  "debugger": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000, capability: "debugging" },
  "code-reviewer": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000, capability: "review" },
  "qa": { reasoning: false, tools: true, vision: true, contextWindowMin: 64_000, capability: "qa" },
  "test-writer": { reasoning: false, tools: true, vision: false, contextWindowMin: 64_000, capability: "testing" },
  "security-auditor": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000, capability: "security" },
};

function requirements(request: RouterRequest): Requirements {
  const profile = ROLE_REQUIREMENTS[getRouterRole()];
  const prompt = request.messages.filter((message) => message.role === "user").at(-1);
  const text = typeof prompt?.content === "string" ? prompt.content.toLowerCase() : "";
  const inferred = /think|architect|debug|review|security|migration|complex/.test(text);
  const complexity = request.state?.complexity ?? activeComplexity;
  return { ...profile, reasoning: profile.reasoning || complexity === "complex" || inferred, contextWindowMin: complexity === "complex" ? Math.max(profile.contextWindowMin, 100_000) : profile.contextWindowMin };
}

// Native SDK transports encode tool calls. This is protocol compatibility,
// not an independent benchmark of the physical model's tool-use quality.
const TOOL_APIS = new Set([
  "openai-completions", "mistral-conversations", "openai-responses",
  "azure-openai-responses", "openai-codex-responses", "anthropic-messages",
  "bedrock-converse-stream", "google-generative-ai", "google-vertex", "pi-messages",
]);
function satisfies(model: any, wanted: Requirements): boolean {
  if (!Number.isFinite(model.contextWindow) || model.contextWindow < wanted.contextWindowMin) return false;
  if (wanted.reasoning && model.reasoning !== true) return false;
  if (wanted.tools && !TOOL_APIS.has(model.api)) return false;
  if (wanted.vision && !model.input?.includes("image")) return false;
  return true;
}
function capabilityPolicy(): { models: Record<string, any>; stages: Record<string, string[]>; allowUnlistedModels: boolean } {
  const file = workbenchPaths().modelCapabilities;
  if (!fs.existsSync(file)) return { models: {}, stages: {}, allowUnlistedModels: true };
  try {
    const policy = JSON.parse(fs.readFileSync(file, "utf8"));
    const models = policy.models ?? policy;
    return { models, stages: policy.stages ?? {}, allowUnlistedModels: policy.defaults?.allowUnlistedModels === true };
  } catch { return { models: {}, stages: {}, allowUnlistedModels: false }; }
}
function modelPolicy(model: any): { capabilities?: string[]; tier?: string; enabled?: boolean } {
  const inline = model.workbenchRouting ?? model.routing;
  if (inline && typeof inline === "object") return inline;
  return capabilityPolicy().models[`${model.provider}/${model.id}`] ?? {};
}
function score(model: any, wanted: Requirements): number {
  if (!satisfies(model, wanted)) return Number.NEGATIVE_INFINITY;
  const policy = modelPolicy(model);
  let value = 0;
  if (policy.capabilities?.includes(wanted.capability)) value += 250;
  if (wanted.reasoning) value += model.reasoning === true ? 100 : -100;
  if (wanted.tools) value += model.compat?.supportsAdditionalTools ? 30 : 0;
  if (wanted.vision) value += model.input?.includes("image") ? 30 : 0;
  if (policy.tier === "expert") value += 30;
  else if (policy.tier === "strong") value += 15;
  value += Math.min((model.contextWindow ?? 0) / 100_000, 10);
  value += Math.min((model.maxTokens ?? 0) / 100_000, 5);
  return value;
}

function available(ctx: ExtensionContext): any[] {
  const scoped = ctx.scopedModels?.map((entry) => entry.model) ?? [];
  return scoped.length ? scoped : (ctx.modelRegistry.getAvailable() as any[]);
}

function choose(request: RouterRequest, ctx: ExtensionContext, wanted: Requirements, excluded = new Set<string>()): any {
  const explicitProvider = process.env[PROVIDER_ENV];
  const explicitModel = process.env[MODEL_ENV];
  const policy = capabilityPolicy();
  let candidates = available(ctx).filter((model) => model.provider !== ROUTER_PROVIDER && !excluded.has(`${model.provider}/${model.id}`));
  if (!policy.allowUnlistedModels && Object.keys(policy.models).length) candidates = candidates.filter((model) => Object.hasOwn(policy.models, `${model.provider}/${model.id}`));
  const allowlist = policy.stages[wanted.capability];
  if (allowlist?.length) candidates = candidates.filter((model) => allowlist.includes(`${model.provider}/${model.id}`));
  const declared = candidates.filter((model) => modelPolicy(model).capabilities?.length);
  if (declared.length) candidates = candidates.filter((model) => modelPolicy(model).enabled !== false && modelPolicy(model).capabilities?.includes(wanted.capability));
  if (explicitProvider || explicitModel) {
    const selected = candidates.find((model) =>
      (!explicitProvider || model.provider === explicitProvider) &&
      (!explicitModel || model.id === explicitModel || `${model.provider}/${model.id}` === explicitModel) &&
      satisfies(model, wanted),
    );
    if (!selected) throw new Error(`Requested router override is unavailable: ${explicitProvider ?? "*"}/${explicitModel ?? "*"}`);
    return selected;
  }
  const ranked = candidates
    .map((model) => ({ model, score: score(model, wanted) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);
  const selected = ranked[0]?.model;
  if (!selected) {
    throw new Error(`No accessible model satisfies router requirements: ${JSON.stringify(wanted)}`);
  }
  if (process.env[TRACE_ENV] === "1") {
    console.error(`[router] ${wanted.reasoning ? "reasoning" : "general"} -> ${selected.provider}/${selected.id}`);
  }
  return selected;
}

function route(request: RouterRequest, ctx: ExtensionContext): ModelRoute<RouterState> {
  const failed = request.failed?.model;
  const complexity = request.state?.complexity ?? activeComplexity;
  // Branch-local quarantine for this retry chain, not a global account blacklist.
  // Pi persists route state even when the selected request subsequently fails.
  const failedModels = new Set<string>(request.reason === "retry" && Array.isArray(request.state?.failedModels) ? request.state.failedModels : []);
  if (failed) failedModels.add(`${failed.provider}/${failed.id}`);
  const sticky = request.reason === "continuation" && !failed ? request.previous?.model : undefined;
  const selected = sticky ?? choose(request, ctx, requirements(request), failedModels);
  return {
    model: selected,
    thinkingLevel: complexity === "complex" ? "high" : complexity === "simple" ? "low" : request.thinkingLevel ?? "medium",
    state: { provider: selected.provider, id: selected.id, complexity, failedModels: [...failedModels] },
  };
}

export default function (pi: ExtensionAPI) {
  pi.events.on(routerRoleEvent, (data) => {
    const request = data as { role?: string; complexity?: string; effectiveRole?: string | null; effectiveComplexity?: string | null; error?: string | null };
    if (!request || typeof request !== "object" || typeof request.role !== "string") return;
    try {
      setRouterRole(request.role, request.complexity);
      request.effectiveComplexity = getRouterComplexity();
      request.effectiveRole = getRouterRole();
    } catch (error) { request.error = error instanceof Error ? error.message : String(error); }
  });
  pi.registerCommand("router-role", {
    description: `Set the routing role (${Object.keys(ROLE_REQUIREMENTS).join(", ")})`,
    handler: async (args, ctx) => {
      const [role, complexity] = args.trim().split(/\s+/);
      if (!Object.hasOwn(ROLE_REQUIREMENTS, role)) {
        ctx.ui.notify(`Unknown role. Choose: ${Object.keys(ROLE_REQUIREMENTS).join(", ")}`, "error");
        return;
      }
      try { setRouterRole(role, complexity); }
      catch (error) { ctx.ui.notify(error instanceof Error ? error.message : String(error), "error"); return; }
      ctx.ui.notify(`Router role set to ${role}${complexity ? ` (${complexity})` : ""}. It applies to the next user request using router/auto.`, "info");
    },
  });
  pi.registerCommand("router-status", {
    description: "Show the effective routing role, selection, and last physical response model",
    handler: async (_args, ctx) => {
      let role: string;
      try {
        role = getRouterRole();
      } catch (error) {
        ctx.ui.notify(`${error instanceof Error ? error.message : error}. Use /router-role to choose a valid role.`, "error");
        return;
      }
      const profile = ROLE_REQUIREMENTS[role];
      const selection = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "unknown";
      const routed = selection === `${ROUTER_PROVIDER}/auto`;
      const lastResponse = ctx.sessionManager.getBranch().findLast(
        (entry) => entry.type === "message" && entry.message.role === "assistant",
      );
      const message = lastResponse?.type === "message" && lastResponse.message.role === "assistant"
        ? lastResponse.message : undefined;
      const physical = message?.provider && message.model && message.provider !== ROUTER_PROVIDER
        ? `${message.provider}/${message.model}`
        : "unknown (no physical response metadata on this branch)";
      ctx.ui.notify([
        `Role: ${role}; base requirements: ${JSON.stringify(profile)}; complexity: ${getRouterComplexity()}`,
        `Selected model: ${selection}; routing: ${routed ? "active for the next user request" : "inactive (select router/auto to apply this role)"}`,
        `Last physical response model: ${physical}`,
        "Role profiles select capabilities, not tool permissions or advisor isolation.",
      ].join("\n"), "info");
    },
  });
  pi.registerVirtualModel<RouterState>({
    provider: ROUTER_PROVIDER,
    id: "auto",
    name: "Auto (capability router)",
    thinkingLevels: ["low", "medium", "high", "xhigh"],
    input: ["text", "image"],
    async route(request, ctx) {
      return route(request, ctx);
    },
  });
}
