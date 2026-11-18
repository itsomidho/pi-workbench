# Capability-based model routing

Workflows request role capabilities, not hardcoded vendor/model identities. `extensions/model-router.ts` implements the current selection policy; `docs/model-router-usage.md` documents commands and runtime verification.

## Current behavior

- Use the session's scoped models when provided, otherwise Pi's available model catalog. Provider adapters expose connectivity, credentials, catalog metadata, and health, not workflow policy.
- Roles specify reasoning, tool-protocol support, vision, and minimum context-window requirements. Latest-prompt inference may also request reasoning.
- Explicit `PI_ROUTER_PROVIDER` / `PI_ROUTER_MODEL` choices narrow selection but do not bypass capability checks. An unavailable or unsuitable override fails explicitly.
- Candidates exclude the virtual router itself and a failed physical model during retry. Compatible candidates are scored using required reasoning/vision/tool support and available context/output-window metadata. Metadata is supplied by Pi/providers/adapters, not an independent capability benchmark.
- Tool continuations retain the previous physical model unless retrying a failure. A role change applies on the next user request using `router/auto`; it does not reroute an already-running request or a directly selected physical model.
- If no candidate satisfies the implemented checks, stop with an explanation. Do not silently switch to an inherited model while claiming the requested router analysis ran.

## Verified role changes

The registered router owns its effective role. Cross-extension callers use `requestRouterRole(pi, role)` from `scripts/router-role.mjs`, which requires acknowledgement through the session event bus. Direct mutable imports are not a shared-state mechanism across isolated Pi extensions.

`/router-status` distinguishes effective capability role, selected virtual/physical model, and the most recent physical response metadata. Historical response evidence is not a prediction of the next dispatch. Record unverified identities as unknown.

## Limits

The current implementation has no configurable maxCost policy file, measured quality-tier ranking, automatic cost/latency optimization, or generic vendor-independent reasoning-effort budget. Do not advertise those as implemented behavior. Additional policy controls need separate design and tests.

Role profiles do not enforce tool permissions, create separate agents, or establish read-only execution. Advisor delegation requires an actual verified boundary. See the Think protocol for coordinator-only fallback disclosure.
