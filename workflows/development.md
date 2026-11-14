# WordPress development workflow

Use the `development` skill as the canonical high-quality workflow. This file defines Pi-specific runtime requirements; the detailed rules remain in `domains/wordpress/workflows/development/SKILL.md` and `domains/wordpress/standards/`.

## Required sequence

1. Identify the domain and repository, then match it to a local project file under `$PI_STANDARDS_DIR/<domain>/projects/`.
2. Read the domain project file, its `checklists/INDEX.md`, and only routed checklists plus `security.md`.
3. If no project file matches, stop and ask the user to run `node scripts/init-project.mjs <domain> <project-name>`; never borrow another project's facts.
4. Create or update a task folder under `$PI_TASKS_DIR/<domain>/<project>/<date>-<slug>/`.
5. For full work, produce a plan and wait for user approval before implementation.
6. Implement, review, fix within the allowed rounds, run browser QA when visible/interactive, add tests when logic warrants them, and run relevant security/performance audits.
7. Keep `TASK.md` owned by the coordinator; agents write numbered reports.
8. At finish, propose standards updates but apply them only after approval. Do not commit, push, or open an MR without explicit approval.

## Model routing

Use `PI_ROUTER_ROLE=planner`, `debugger`, `code-reviewer`, `qa`, or the matching role through `/router-role`. Never hardcode a provider or model ID.
