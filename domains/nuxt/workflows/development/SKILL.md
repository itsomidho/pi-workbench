---
name: nuxt-development
description: "Plan, implement, review, QA, test, and audit approved Nuxt changes using the nuxt domain pack. Use for non-trivial Nuxt features/fixes after domain confirmation; /development is the generic domain-selecting entry point."
---

# Nuxt development playbook

## Entry and approval

Read this pack's standards/README.md, the matching local project file, routed checklists, and nuxt-guide. Confirm the affected component, installed framework/runtime versions, router/layout, package manager, rendering mode, and deployment target. Missing facts require clarification, not another project's settings or a framework upgrade.

Accept the request or approved Think brief. Record scope, constraints, acceptance criteria, safe test services, and verification commands. Inspect Git status read-only; never stash, discard, or switch unrelated work automatically. Reuse settled Think decisions. Present a plan and obtain explicit approval before implementation, task creation, dependency installation, or repository changes.

For managed work, use `piw init-from-think nuxt <project> <slug> <note>` or `piw task create nuxt <project> <slug> <title>`. Save the approved plan in TASK.md, transition to awaiting-approval, then record the user's approval with `piw task approve <identifier>`. Start `/task-go <identifier>` only using a real Pi command capability; otherwise provide that exact command. Slash commands are not shell commands. Never start a second workflow.

## Stage ownership

workflow.json declares managed-development-v1. The engine owns progression, handoffs, and bounded fix loops. Execute only the current requested stage, not this whole playbook recursively. The coordinator owns TASK.md; stage work writes its numbered report and requested workflow_handoff. Current-session roles are not independent agents or enforced tool boundaries; disclose missing delegation.

| Stage | Required outcome |
|---|---|
| plan | Inspect and propose scoped files, rendering/data flow, security/cache risks, verification, and deployment impact; no implementation. |
| implement | Implement only the approved plan using existing project conventions; record files and focused checks. |
| review | Review without editing; evidence-backed findings with severity, file/line, impact, and blocking flag. |
| fix | Address only listed findings and rerun focused checks; let the engine schedule re-review. |
| qa | Check relevant browser/API flows, hydration, permissions, cache isolation, accessibility, and responsive behavior. |
| test | Add/run focused regressions with configured test tooling and safe services; record skipped coverage. |
| audit | Review server security, payload/cache isolation, rendering/runtime compatibility, performance, and unresolved findings. |
| finish | Summarize actual evidence, risks, deployment/recovery notes, and remaining approvals without adding scope. |

## Stack-specific requirements

- Confirm the installed Nuxt/Vue versions and layout, SSR-safe composables, hydration and async-data keys, Nitro/H3 server authorization, runtimeConfig exposure, and rendering/cache rules.
- Confirm Nuxt major version and the actual app/srcDir layout before choosing APIs. Keep per-request state isolated, avoid browser-only APIs during SSR, and use stable async-data keys without sharing personalized cached payloads. Verify ssr, routeRules, Nitro caching, prerendering, and deployment preset behavior for this version.
- Authorize each Nitro/H3 handler or other server entry point and scope data to the user/tenant; client navigation middleware and hidden UI are not server security boundaries. Validate input and protect session mutations. Keep secrets out of public runtimeConfig, client bundles, rendered HTML, and serialized Nuxt payloads.
- Cover SSR/direct reload and client navigation, hydration, loading/error/not-found states, authorized and denied server requests, validation failures, tenant/user isolation, cache/payload isolation, accessibility, and responsive behavior where affected. Use the project's configured test stack and fake external services. Inspection is not proof of a passing browser or application test.
- Use only the confirmed package manager and scripts in package.json for lint, typecheck, focused/full tests, browser checks, and build. Inspect the lockfile and packageManager field; do not mix lockfiles, install dependencies, or silently download tools. Builds/prerendering can fetch data or run code, so verify the environment and service fakes first.

## Stop conditions

Pause for unknown versions/environment, missing services/access, unsafe data effects, changed scope, repeated failure, or unresolved blocking findings. Never claim tests/browser access/independent review that did not occur. Quality-gate JSON is guidance, not an arbitrary command runner. Commits, pushes, tags, publication, production access, migrations, and deployments require separate explicit approval.
