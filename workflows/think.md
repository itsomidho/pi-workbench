# Think workflow for Pi

Request: $ARGUMENTS

Use this workflow before non-trivial changes or decisions. The coordinator owns the note, questions, approval gate, and handoff.

## Runtime

- Read the Workbench `skills/think/SKILL.md` for the conversation protocol, resolving it from `$PI_CONFIG_DIR` or the installed Workbench package root when unset (normally `$HOME/.pi-workbench`). Use that exact file, not a same-named skill from another package.
- Use `/router-role think` for the main analysis request.
- Before substantive analysis, use `/router-role think-advisor` in the delegated runtime only when delegation and a verified read-only or tool-less execution boundary are available. Do not switch the coordinator to the advisor role.
- Use `/router-status` to confirm the effective profile. These are Pi commands, not shell commands; if current-session invocation is unavailable, disclose that verification is unavailable.
- Keep the advisor read-only; it must not edit, delegate, or launch work. A role profile or `tools: false` does not enforce permissions.

## Sequence

1. Restate the topic and classify it.
2. Read relevant files and project standards without editing. Discover domains with `piw domain detect <affected-repository-or-component-directory>`; use the injected discovery context when applicable, re-running detection if the affected component differs from the current directory. Read the selected manifest route entry and matched local project file from the injected standards discovery. Respect its effective standards root, home-relative/canonical path matching, and ambiguity/errors; do not conclude a project file is missing from its filename or a basename grep. Never assume WordPress. Ambiguous, unconfirmed, or unsupported results require clarification or an approved main-session fallback.
3. Ask only blocking questions.
4. Ask the verified read-only advisor for facts, assumptions, options, risks, and one recommendation; otherwise disclose coordinator-only analysis.
5. Present the recommendation and wait for `go`.
6. Write the decision and plan into the local think note.
7. Route to the confirmed domain manifest’s workflow entry only after approval. For a managed route, include the exact approved task identifier and a `simple`, `moderate`, or `complex` complexity row in the assistant handoff. The user's plain `go` starts only that linked task after the runtime revalidates its status and approval hash; it never selects a global newest task. Record domain, evidence, route entry, engine, and execution limitations in the note. Use only supported managed engines; a pack directory or role name does not create executable agent support.
8. Record requested and confirmed router roles and the physical `provider/model` from response metadata in the handoff. Mark unverified values unknown; selected virtual models do not establish physical dispatch.

A missing advisor delegation tool or unverified execution boundary is a limitation: report “Advisor unavailable; coordinator-only analysis”. Do not claim an advisor ran when the coordinator performed the analysis. Use only tools available in this session, and route unsupported domains to the approved main-session plan rather than inventing a managed workflow.
