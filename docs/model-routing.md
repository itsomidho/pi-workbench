# Capability-based model routing

Workflows request role capabilities, not hardcoded vendor/model identities. `extensions/model-router.ts` implements the current selection policy; `docs/model-router-usage.md` documents commands and runtime verification.

## Workbench commands

| Command | Purpose |
| --- | --- |
| `piw run [Pi arguments…]` | Start Pi in the current project using `router/auto` by default. |
| `piw run --models 'provider/model-a,provider/model-b'` | Limit the models available in this session. |
| `piw model-capabilities init [path] [--force]` | Create a policy interactively and print the saved JSON. To replace a file, specify its path before `--force`. |
| `piw model-capabilities list [path]` | Display saved models and stage allowlists. |
| `piw model-capabilities validate [path]` | Check policy structure without contacting providers. |
| `/router-role <role> [complexity]` | Set routing requirements for the next routed request. |
| `/router-status` | Show the active role, selection, and last physical response model. |

See [the session-scope examples](model-router-usage.md#session-model-scope) for the difference between listing, scoping, and selecting a model.

## Current behavior

- Use the session's scoped models when provided, otherwise Pi's available model catalog. Provider adapters expose connectivity, credentials, catalog metadata, and health, not workflow policy.
- Roles specify a work capability (`planning`, `coding`, `debugging`, `review`, `qa`, `testing`, or `security`) plus reasoning, tool-protocol support, vision, and minimum context-window requirements. Task complexity (`simple`, `moderate`, or `complex`) adjusts reasoning/context requirements and selected thinking level.
- Explicit `PI_ROUTER_PROVIDER` / `PI_ROUTER_MODEL` choices narrow selection but do not bypass capability checks. An unavailable or unsuitable override fails explicitly.
- Candidates exclude the virtual router itself and every physical model already failed in the current retry chain. Branch-local router state prevents A→B→A cycling; a new user request resets that quarantine. Exhaustion fails explicitly rather than silently reusing a failed candidate. Compatible candidates are scored using required reasoning/vision/tool support and available context/output-window metadata. Metadata is supplied by Pi/providers/adapters, not an independent capability benchmark.
- Tool continuations retain the previous physical model unless retrying a failure. A role change applies on the next user request using `router/auto`; it does not reroute an already-running request or a directly selected physical model.
- If a model capability policy is supplied through `PI_MODEL_CAPABILITIES_FILE`, declared candidates are restricted to the requested work capability and scored by declared tier (`standard`, `strong`, or `expert`). Without that policy, routing remains conservative metadata-based selection and does not claim benchmarked coding/planning quality. If no candidate satisfies the implemented checks, stop with an explanation. Do not silently switch to an inherited model while claiming the requested router analysis ran.

Catalog visibility and credentials do not guarantee that an account/guardrail policy permits a model. Automatic selection only falls back when Pi schedules a retry; non-retryable failures are not automatically retried by Workbench. Retry counts and delays remain Pi's responsibility. Use approved scoped models (`piw run --models 'provider/model-one,provider/model-two'`) when the catalog includes inaccessible candidates. A pinned failed model fails explicitly; Workbench never overrides account guardrails to obtain a response.

## Assistant-callable tools

The model-router extension also registers these tools in the current session:

| Tool | Purpose |
| --- | --- |
| `router_set_role({ role, complexity? })` | Update the registered router role and return status. |
| `router_status({})` | Return role, complexity, selection, routing-active flag, and historical physical response identity (null when unknown). |
| `think_advisor({ brief })` | Run one separate tool-less analysis using the think-advisor capability profile. |

Role changes take effect on the **next user request** using `router/auto`, not a tool continuation already in progress. A directly selected physical model remains direct. Status is not proof of next-dispatch identity.

The Advisor uses the same session model scope, saved capability policy, and explicit router overrides, but selects against its own profile without changing the coordinator role. It makes one authenticated `modelRegistry.streamSimple` request, with an independent system prompt, only the supplied brief, and an empty tool list. There is no agent loop, tool dispatcher, filesystem/resource discovery, session-history forwarding, MCP connection, or nested delegation. Unexpected tool calls are rejected, never executed. This is a model-request boundary, **not an OS sandbox**: installed provider/extension code remains trusted.

Limits: 48,000 brief characters, 4,096 output tokens, 120 seconds, and one concurrent Advisor request per session. Cancellation signals reach the provider; timeout/cancellation return even if a provider ignores abort, but cannot guarantee upstream billing stops. Errors, truncation, empty responses, or unverified physical identities do not count as successful review. No automatic retry or scope expansion is performed. The tool returns response-model identity and usage when available. It can use the same physical model as the coordinator and cannot independently inspect sources. Never send credentials in briefs; provider policies and normal request costs apply. Treat its output as advice, not execution authority.

The Think protocol prefers these tools and retains the explicit “Advisor unavailable; coordinator-only analysis” fallback on absence/failure. Custom tool allowlists can hide them; include their names when using an explicit `--tools` allowlist. Updating this checkout does not update a separate installed copy: update the Workbench package through your usual local installation process, then `/reload` or restart Pi. No upstream Pi patch is required.

## Verified role changes

The registered router owns its effective role. Cross-extension callers use `requestRouterRole(pi, role)` from `scripts/router-role.mjs`, which requires acknowledgement through the session event bus. Direct mutable imports are not a shared-state mechanism across isolated Pi extensions.

`/router-status` distinguishes effective capability role, selected virtual/physical model, and the most recent physical response metadata. Historical response evidence is not a prediction of the next dispatch. Record unverified identities as unknown.

## Limits

The current implementation has no configurable maxCost policy file, measured quality-tier ranking, automatic cost/latency optimization, or generic vendor-independent reasoning-effort budget. Do not advertise those as implemented behavior. Additional policy controls need separate design and tests.

Role profiles do not enforce tool permissions, create separate agents, or establish read-only execution. Advisor delegation requires an actual verified boundary; the bundled `think_advisor` tool supplies the single-request tool-less boundary described above. See the Think protocol for coordinator-only fallback disclosure.
