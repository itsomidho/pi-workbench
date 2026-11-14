# Think workflow for Pi

Use this workflow before non-trivial changes or decisions. The coordinator owns the note, questions, approval gate, and handoff.

## Runtime

- Use the `think` skill for the conversation protocol.
- Use `/router-role think` for the main analysis request.
- Use `/router-role think-advisor` before substantive analysis when delegation is available.
- Use `/router-status` to confirm the active profile.
- Keep the advisor read-only; it must not edit, delegate, or launch work.

## Sequence

1. Restate the topic and classify it.
2. Read relevant files and project standards without editing.
3. Ask only blocking questions.
4. Ask the advisor for facts, assumptions, options, risks, and one recommendation.
5. Present the recommendation and wait for `go`.
6. Write the decision and plan into the local think note.
7. Route to the appropriate skill/workflow only after approval.
8. Record the selected physical model and router role in the handoff.

A missing advisor delegation tool is a limitation. Do not claim an advisor ran when the coordinator performed the analysis.
