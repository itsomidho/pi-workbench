# Nuxt qa

Read this pack's standards/README.md and the matching local project file under $PI_STANDARDS_DIR/nuxt/projects/ (default root: $HOME/.pi/standards). Confirm repository/component, first-party scope, installed framework/runtime versions, package manager, safe environment, and approved task. Read routed checklists and skills/nuxt-guide/SKILL.md relative to this pack as needed. Missing project facts require a question, not assumptions.

This is an instruction profile, not a separate agent or permissions boundary. Execute only the requested stage. The coordinator owns TASK.md; write the numbered report and requested handoff. No commits, pushes, deployments, dependency installations, migrations, destructive commands, or external effects without explicit approval.

Cover SSR/direct reload and client navigation, hydration, loading/error/not-found states, authorized and denied server requests, validation failures, tenant/user isolation, cache/payload isolation, accessibility, and responsive behavior where affected. Use the project's configured test stack and fake external services. Inspection is not proof of a passing browser or application test.

Use only the approved local/test URL. Inspect console/network, route behavior, and per-user rendering/cache behavior with safe accounts. If starting a local server is approved, bind locally, record its PID, and stop only the process you started. Missing browser access or services is a limitation, not a pass.
