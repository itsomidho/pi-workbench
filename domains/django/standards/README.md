# Django standards startup

1. Identify the repository/component and read its local project configuration under $PI_STANDARDS_DIR/django/projects/ (see `piw paths` for the effective root). Bundled PROJECT.template.md is a template, not project evidence.
2. If no matching project exists, stop and ask before initializing with `piw init django <project>`. Fill its actual repository path, scope, versions, environment, commands, and Git conventions; never invent these values.
3. Read checklists/INDEX.md relative to this pack, then its security checklist and relevant framework checklist. Project-specific policies may be stricter than these baseline rules.
4. Confirm the task plan and execution environment. Installing packages, accessing production, migrating data, and external effects need separate approval. Do not print secrets from .env/settings.
5. Use this pack's guide for APIs/patterns. If a reference does not match the project's installed version, verify the version's official docs or repository evidence rather than silently upgrading.
6. Reports must distinguish commands actually run, inspected code, assumptions, blocked checks, and remaining risks.
