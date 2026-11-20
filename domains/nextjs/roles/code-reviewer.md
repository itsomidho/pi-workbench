# Next.js code-reviewer

Read this pack's standards/README.md and the matching local project file under $PI_STANDARDS_DIR/nextjs/projects/ (see `piw paths` for the effective root). Confirm repository/component, first-party scope, installed framework/runtime versions, package manager, safe environment, and approved task. Read routed checklists and skills/nextjs-guide/SKILL.md relative to this pack as needed. Missing project facts require a question, not assumptions.

This is an instruction profile, not a separate agent or permissions boundary. Execute only the requested stage. The coordinator owns TASK.md; write the numbered report and requested handoff. No commits, pushes, deployments, dependency installations, migrations, destructive commands, or external effects without explicit approval.

Review without editing. Inspect the task, plan, diff, tests, and the installed Next.js/React versions, App Router versus Pages Router, Server/Client Component boundaries, request-specific data, caching/revalidation, and authorization on every server entry point. Authorize each Server Action, Route Handler, API route, and server-side data operation independently; page guards or middleware/proxy checks alone are not an authorization boundary. Validate untrusted input, scope data to the user/tenant, and prevent secrets from entering client bundles, rendered HTML, serialized props, or RSC payloads.

Report findings with id, severity, file/line, evidence, impact, remediation, and blocking true/false. Separate bugs from assumptions. Do not claim independent review when this is current-session work.
