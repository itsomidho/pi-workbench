# Pi Workbench

Pi Workbench is a portable, vendor-neutral harness for Pi. It provides reusable roles, skills, domain packs, workflow orchestration, capability-based model routing, local project standards, task lifecycle management, and an independent provider-adapter generator.

It does not require Claude Code or Codex. Provider credentials, OAuth state, project facts, task state, and machine-specific paths remain outside this repository.

## Architecture

```text
pi-workbench/
├── adapters/       Provider adapter template and contract
├── config/         Configuration examples
├── domains/        Domain packs, currently WordPress
├── docs/           Routing and usage documentation
├── extensions/     Pi model router and task workflow extension
├── scripts/        Installation, validation, task, and adapter commands
├── skills/         Generic skills such as think and think-advisor
└── workflows/      Generic prompts and task template
```

A domain pack owns its domain-specific behavior:

```text
domains/wordpress/
├── roles/
├── skills/
├── standards/
└── workflows/
```

Generic roles and workflow tooling must not duplicate domain rules. Domain standards remain the source of truth for domain-specific checks.

## Requirements

- Node.js 18 or newer
- npm
- Pi
- Git for project workflows

## Install

From the repository:

```bash
./scripts/install.sh
./scripts/doctor.sh
npm install -g .
piw --help
```

The `piw` command is the supported CLI for daily project, task, adapter, and validation operations. The underlying scripts remain available for automation.

To install this repository as a local Pi package:

```bash
pi install /path/to/pi-workbench
```

The installer creates only local runtime directories. It does not copy credentials or project facts:

```text
$HOME/.pi/agent       Pi runtime data
$HOME/.pi/standards   Local standards root
$HOME/.pi/tasks       Local task workspace
```

Override these locations when needed:

```bash
PI_AGENT_DIR="$HOME/.config/pi/agent" \
PI_STANDARDS_DIR="$HOME/.config/pi/standards" \
PI_TASKS_DIR="$HOME/.config/pi/tasks" \
./scripts/install.sh
```

## Pi Workbench CLI

Common commands:

```bash
piw init wordpress sample-site
piw init-from-think wordpress sample-site seo-fix "$HOME/.pi/think/2026-01-01-seo-fix.md"
piw task create wordpress sample-site seo-fix "Fix SEO metadata"
piw task list
piw task transition wordpress/sample-site/2026-01-01-seo-fix reviewing
piw task artifacts context "$HOME/.pi/tasks/wordpress/sample-site/2026-01-01-seo-fix"
piw adapter create example-provider ../pi-example-provider
piw check
piw doctor
piw version
```

Use `piw help` for the complete command list.

## Local project standards

Project facts are private local overlays. They are never bundled in this repository.

Create a project standards file with the domain-aware command:

```bash
PI_STANDARDS_DIR="$HOME/.pi/standards" \
  node scripts/init-project.mjs wordpress sample-site
```

The result is:

```text
$HOME/.pi/standards/wordpress/projects/sample-site.md
```

The command resolves the template from:

```text
domains/wordpress/standards/projects/PROJECT.template.md
```

A future domain can provide its own template at the equivalent path:

```text
domains/laravel/standards/projects/PROJECT.template.md
```

## Tasks and workflows

Create a domain-aware task after the local project file exists:

```bash
node scripts/create-task.mjs \
  wordpress sample-site seo-fix "Fix SEO metadata"
```

Tasks are stored outside the repository. Each task has a small shared context and one compact handoff brief per stage:

```text
$HOME/.pi/tasks/wordpress/sample-site/YYYY-MM-DD-seo-fix/
├── TASK.md
└── artifacts/
    ├── shared-context.json
    └── briefs/
        ├── 01-plan.json
        ├── 02-implement.json
        └── ...
```

A stage should receive only the shared task context, the direct previous-stage brief, and relevant evidence. Full conversation history and unrelated reports should not be forwarded between stages.

The lifecycle requires planning and explicit approval before implementation:

```text
planning
  -> awaiting-approval
  -> implementing
  -> reviewing
  -> fixing / qa / testing / auditing / finishing
  -> done
```

Useful Pi commands:

```text
/task-init <domain> <project> <slug> <title>
/task-list
/task-status <domain>/<project>/<date-slug> <status>
/task-approve <domain>/<project>/<date-slug>
/task-start <domain>/<project>/<date-slug> <plan|implement|review|fix|qa|test|audit|finish>
/task-run <domain>/<project>/<date-slug> <stage>
/task-report <domain>/<project>/<date-slug> <NN-step> <summary>
```

CLI equivalents:

```bash
node scripts/list-tasks.mjs
node scripts/task-transition.mjs \
  wordpress/sample-site/2026-01-01-seo-fix reviewing
```

After a plan is approved, start the managed workflow with:

```text
/task-go <domain>/<project>/<date-slug>
```

You can resume a paused workflow with `/task-go-resume <domain>/<project>/<date-slug>` or stop after the current stage with `/task-go-stop`. The orchestrator runs implementation, review, bounded fix/review loops, QA, tests, audit, and finish. It pauses when a handoff brief is missing, a maximum fix round is reached, or user input is required. It records response usage in `artifacts/usage.jsonl` and writes `FINAL.md` when the workflow completes.

Do not commit, push, post, publish, or open a merge request unless the user explicitly approves it.

## Model routing

Use the virtual model `router/auto` for capability-based selection:

```bash
pi --model router/auto
```

Select a role when needed:

```bash
PI_ROUTER_ROLE=debugger pi --model router/auto
PI_ROUTER_ROLE=code-reviewer pi --model router/auto
```

Optional controls:

```text
PI_ROUTER_PROVIDER   Restrict selection to one configured provider
PI_ROUTER_MODEL      Restrict selection to one configured model
PI_ROUTER_TRACE=1    Log the selected provider and model
```

The router selects from accessible models using requirements such as reasoning, tools, vision, and context window. It does not bundle provider credentials or assume a specific vendor.

See `docs/model-routing.md` and `docs/model-router-usage.md` for details.

## Independent provider adapters

Pi Workbench does not bundle a provider-specific adapter. Generate one as a separate project:

```bash
node scripts/create-adapter.mjs example-provider ../pi-example-provider
cd ../pi-example-provider
npm test
```

The generated package follows the `pi-<name>` convention. Replace the protocol-specific implementation, configure credentials outside Git, and install or publish the adapter independently.

Adapter responsibilities:

- Resolve its own URL and credentials.
- Discover and normalize provider models.
- Declare provider capabilities.
- Avoid logging secrets.
- Leave model selection to Pi Workbench's router.

## Adding a domain

A domain pack should contain only domain-specific behavior and declare it in `domain.json`:

```text
domains/<domain>/
├── domain.json
├── roles/
├── skills/
├── standards/
│   └── projects/PROJECT.template.md
├── workflows/
└── quality-gates.json
```

The manifest identifies the domain resources and allows validation without hardcoded paths. Add the domain's skills and prompts to the package manifest, provide its standards template, and add its workflow policy if it uses the task extension. Do not place real project files in the repository.

## Development checks

Run all local checks before a release:

```bash
npm run check
npm test
./scripts/doctor.sh
piw check
piw doctor
git diff --check
```

For a clean installation test, use an isolated home directory or a disposable LXD container. Never modify an existing production or project container for portability testing.

## Security and portability

- Keep API keys, tokens, OAuth state, and private URLs outside Git.
- Use environment variables or Pi's local authentication store for credentials.
- Review third-party Pi packages and adapters before installing them.
- Do not copy local project standards into the portable repository.
- Do not hardcode user home directories or machine-specific paths.
- Do not claim provider support until its adapter and runtime behavior have been tested.

## Release checklist

The current development line is documented in `CHANGELOG.md`. Version `0.3.0` is the first release line with managed multi-stage orchestration and Pi RPC integration coverage.

1. Run `npm run check` and `npm test`.
2. Run `./scripts/doctor.sh`.
3. Test installation with isolated local directories.
4. Verify no project facts or secrets are tracked.
5. Review `git diff --check` and `git status`.
6. Commit only after explicit approval.
7. Create a version tag only after the commit is verified.
