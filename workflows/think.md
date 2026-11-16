# Think workflow for Pi

Use this workflow before non-trivial changes or decisions. The coordinator owns the note, questions, approval gate, and handoff.

## Runtime

- Use the `think` skill for the conversation protocol.
- Use `/router-role think` for the main analysis request.
- Before substantive analysis, use `/router-role think-advisor` in the delegated runtime only when delegation and a verified read-only or tool-less execution boundary are available. Do not switch the coordinator to the advisor role.
- Use `/router-status` to confirm the effective profile. These are Pi commands, not shell commands; if current-session invocation is unavailable, disclose that verification is unavailable.
- Keep the advisor read-only; it must not edit, delegate, or launch work. A role profile or `tools: false` does not enforce permissions.

## Sequence

1. Restate the topic and classify it.
2. Read relevant files and project standards without editing.
3. Ask only blocking questions.
4. Ask the verified read-only advisor for facts, assumptions, options, risks, and one recommendation; otherwise disclose coordinator-only analysis.
5. Present the recommendation and wait for `go`.
6. Write the decision and plan into the local think note.
7. Route to the appropriate skill/workflow only after approval.
8. Record requested and confirmed router roles and the physical `provider/model` from response metadata in the handoff. Mark unverified values unknown; selected virtual models do not establish physical dispatch.

A missing advisor delegation tool or unverified execution boundary is a limitation: report “Advisor unavailable; coordinator-only analysis”. Do not claim an advisor ran when the coordinator performed the analysis. Use only tools available in this session, and route unsupported domains to the approved main-session plan rather than inventing a managed workflow.
