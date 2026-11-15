import type { ExtensionAPI, ExtensionContext, ModelRoute, ModelRouteRequest } from "@earendil-works/pi-coding-agent";

type Requirements = {
  reasoning: boolean;
  tools: boolean;
  vision: boolean;
  contextWindowMin: number;
};

type RouterState = { provider: string; id: string };
type RouterRequest = ModelRouteRequest<RouterState>;

const ROUTER_PROVIDER = "router";
const ROLE_ENV = "PI_ROUTER_ROLE";
const PROVIDER_ENV = "PI_ROUTER_PROVIDER";
const MODEL_ENV = "PI_ROUTER_MODEL";
const TRACE_ENV = "PI_ROUTER_TRACE";
const DEFAULT_REQUIREMENTS: Requirements = { reasoning: false, tools: true, vision: false, contextWindowMin: 64_000 };
let activeRole = process.env[ROLE_ENV] ?? "default";
export function setRouterRole(role: string) {
  if (!ROLE_REQUIREMENTS[role]) throw new Error(`Unknown router role: ${role}`);
  activeRole = role;
}
export function getRouterRole() {
  return activeRole;
}

const ROLE_REQUIREMENTS: Record<string, Requirements> = {
  default: DEFAULT_REQUIREMENTS,
  think: { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000 },
  "think-advisor": { reasoning: true, tools: false, vision: false, contextWindowMin: 100_000 },
  "planner": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000 },
  "developer": { reasoning: false, tools: true, vision: false, contextWindowMin: 64_000 },
  "debugger": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000 },
  "code-reviewer": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000 },
  "qa": { reasoning: false, tools: true, vision: true, contextWindowMin: 64_000 },
  "test-writer": { reasoning: false, tools: true, vision: false, contextWindowMin: 64_000 },
  "security-auditor": { reasoning: true, tools: true, vision: false, contextWindowMin: 100_000 },
};

function requirements(request: RouterRequest): Requirements {
  const profile = ROLE_REQUIREMENTS[process.env[ROLE_ENV] ?? activeRole] ?? ROLE_REQUIREMENTS.default;
  const prompt = request.messages.filter((message) => message.role === "user").at(-1);
  const text = typeof prompt?.content === "string" ? prompt.content.toLowerCase() : "";
  const inferred = /think|architect|debug|review|security|migration|complex/.test(text);
  return { ...profile, reasoning: profile.reasoning || inferred };
}

function satisfies(model: any, wanted: Requirements): boolean {
  if (model.contextWindow && model.contextWindow < wanted.contextWindowMin) return false;
  if (wanted.reasoning && model.reasoning !== true) return false;
  if (wanted.tools && model.api && !["openai-responses", "openai-completions", "anthropic-messages", "google-generative-ai"].includes(model.api)) return false;
  if (wanted.vision && !model.input?.includes("image")) return false;
  return true;
}
function score(model: any, wanted: Requirements): number {
  if (!satisfies(model, wanted)) return Number.NEGATIVE_INFINITY;
  let value = 0;
  if (wanted.reasoning) value += model.reasoning === true ? 100 : -100;
  if (wanted.tools) value += model.compat?.supportsAdditionalTools ? 30 : 0;
  if (wanted.vision) value += model.input?.includes("image") ? 30 : 0;
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
  const candidates = available(ctx).filter((model) => model.provider !== ROUTER_PROVIDER && !excluded.has(`${model.provider}/${model.id}`));
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
  const failedKey = failed ? `${failed.provider}/${failed.id}` : undefined;
  const sticky = request.reason !== "user" && !failed ? request.previous?.model : undefined;
  const selected = sticky ?? choose(request, ctx, requirements(request), failedKey ? new Set([failedKey]) : undefined);
  return {
    model: selected,
    thinkingLevel: request.thinkingLevel,
    state: { provider: selected.provider, id: selected.id },
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("router-role", {
    description: `Set the routing role (${Object.keys(ROLE_REQUIREMENTS).join(", ")})`,
    handler: async (args, ctx) => {
      const role = args.trim();
      if (!ROLE_REQUIREMENTS[role]) {
        ctx.ui.notify(`Unknown role. Choose: ${Object.keys(ROLE_REQUIREMENTS).join(", ")}`, "error");
        return;
      }
      activeRole = role;
      ctx.ui.notify(`Router role set to ${role}. It applies to the next user request.`, "info");
    },
  });
  pi.registerCommand("router-status", {
    description: "Show the active capability-routing role",
    handler: async (_args, ctx) => {
      const profile = ROLE_REQUIREMENTS[activeRole] ?? ROLE_REQUIREMENTS.default;
      ctx.ui.notify(`Role: ${activeRole}; requirements: ${JSON.stringify(profile)}`, "info");
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
