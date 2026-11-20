# Nuxt standards startup

1. Identify the affected repository/component and read its local project configuration under $PI_STANDARDS_DIR/nuxt/projects/ (see `piw paths` for the effective root). The bundled PROJECT.template.md is not project evidence.
2. If missing, ask before initializing with `piw init nuxt <project>`; fill actual paths, versions, scope, environment, package manager, commands, and Git conventions. Do not borrow another project's facts or print .env secrets.
3. Read checklists/INDEX.md, security.md, and relevant framework checks relative to this pack. Local project policies may be stricter.
4. Confirm plan approval, safe test services, rendering strategy, and deployment target. Package installation, network effects, migrations, and production access need separate permission.
5. Read this pack's guide for implementation patterns. Verify APIs against the installed version and repository evidence, rather than silently upgrading.
6. Report actual commands/results, inspected evidence, assumptions, blocked checks, and remaining risks separately.
