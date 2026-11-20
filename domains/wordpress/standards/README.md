# WordPress standards (shared)

The single source of project facts and code rules for every WordPress agent (`developer`, `code-reviewer`, `debugger`, `test-writer`, `qa`, `performance-auditor`, `security-auditor`, `migrator`) and the `merge-request-review` skill. Change a rule here, never inside an agent or skill.

```
$PI_STANDARDS_DIR/wordpress/projects/<name>.md   private facts per repository
checklists/INDEX.md     routing table (which checklist applies to which files) + severity rules
checklists/*.md         the rules, one domain per file
```

`PI_STANDARDS_DIR` is the local standards root (default `$HOME/.config/pi-workbench/standards`), not this bundled directory. Resolve `checklists/` below relative to this README. Real project facts are not bundled with Workbench; local project-specific policies may extend these baseline rules.

## Startup procedure (every agent, before any work)

1. **Identify the project.** Match `git remote get-url origin` (or the current path) against the GitLab paths and local paths in `$PI_STANDARDS_DIR/wordpress/projects/*.md`. Read the matching file in full. If none matches, read-only stack detection is allowed, but stop before execution and ask for project setup with `piw init wordpress <project>`; never borrow another project's facts.
2. **Respect scope.** Work only in the first-party paths the project file lists. Never edit vendored, generated or third-party code (`vendor/`, `node_modules/`, build output, third-party plugins).
3. **Load the checklists** for the files you'll read or touch: read `checklists/INDEX.md`, then only the checklists its routing table selects. `security.md` always applies.
4. **Project facts win.** Where a project file and a generic checklist disagree (Sage version, PHP floor/runtime, cache setup), follow the project file.
5. **Environment safety.** Test commands, cache purges, cron/job execution, migrations, and browser scenarios are examples, not authorization for production or real external effects. Confirm the local/test environment and obtain separate approval for database changes, remote writes, or real service calls. Derive test-suite and cache topology from this project's facts; do not inherit another project's assumptions.
6. **Unknown means unknown.** If a project file marks something as unknown (e.g. the object cache), write and judge code so it's correct under every option, and don't state a guess as fact.

## How each role uses the checklists

| Role | Use |
|---|---|
| Writing code (`developer`) | Requirements: new code must not introduce anything a checklist would flag. Self-review the diff against them before finishing. |
| Reviewing (`code-reviewer`, MR skill) | Findings: report what violates them, with severity from `INDEX.md`. |
| Debugging (`debugger`) | Hypotheses: many bugs are a checklist item (cache, hooks, escaping, version floor). The fix itself must pass the checklists. |
| Testing (`test-writer`) | Cases: security and edge-case items become test cases (deny paths, invalid input, cache-correct behavior). Test code obeys the PHP floor too. |
| Browser QA (`qa`) | Watch-list: while exercising the feature on the local site, look for what `page-cache.md`, `javascript.md` and `css-scss.md` describe (per-visitor HTML, console errors, RTL/mobile breakage). When a scenario changes site state that can produce redirects or cached responses (deactivating a plugin or post type, changing permalinks or options), run it in an isolated browser context (`new_page` with `isolatedContext`), never the user's tabs: browsers keep 301s, so redirects seen during the test stick in the user's browser afterwards (added 2026-10-19). After restoring the state, flush rewrite rules if a plugin with CPTs was toggled. |
| Performance audit (`performance-auditor`) | Judgement: measured problems are traced to code and matched to `performance.md` / `page-cache.md` items. |
| Security audit (`security-auditor`) | Judgement over the whole codebase, not a diff: every entry point traced against `security.md`. |
| Migration (`migrator`) | Target state: migrated code must pass the checklists for the new stack. Updates the project file when done. |

## Figma designs (added 2026-10-21)

Check the actual tools available to the executing session; a role profile does not establish Figma access or permission boundaries. When delegated execution lacks Figma tools, the orchestrator (main session), if it has access, pulls the values with `get_design_context` / `get_screenshot` and writes them to a spec file in the task folder (e.g. `01b-figma-spec.md`: sizes, spacing, colours, typography, screen positions, assets) before planning or implementing; it also downloads any new assets for the developer. Agents treat that spec as the visual source of truth. Figma frames are authored LTR: the spec should state on-screen positions, since the first DOM child renders on the right in RTL markup.

## Task workspace (when called by the `development` orchestrator)

If your prompt names a **task folder** (`$PI_TASKS_DIR/wordpress/<project>/<date>-<slug>/`):
- Read its `TASK.md` before anything else, then only the earlier reports the prompt lists. TASK.md holds the brief, the approved plan, the user's decisions, files changed and open findings. Its decisions bind you like project facts.
- Write your full report to the file path given in the prompt. Writing that report is allowed even for read-only roles (reviewer, auditors); it's not a code change.
- Never edit `TASK.md`; the orchestrator owns it. Put questions for the user in your reply.
- Reply with the short summary the prompt asks for, not the full report.

Without a task folder, work as usual and report in your reply.

## Adding to the standards

- New repo → run `piw init wordpress <project>`, then fill the private project file under `$PI_STANDARDS_DIR/wordpress/projects/`. Do not copy another project's facts or add real project files to the application bundle.
- New rule → add it to the right checklist. If it's a new domain, create a checklist and add a row to the routing table in `INDEX.md`.
- New fact learned while working (server change, new plugin, version bump) → update the project file and note the date.
- `/development` proposes such updates at the end of each task (its retrospective step); they're applied only after the user approves.
