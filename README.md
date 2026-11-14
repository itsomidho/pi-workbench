# Pi Workbench

Vendor-neutral configuration and workflows for Pi. Claude Code and Codex are optional clients/providers, not runtime dependencies.

## Principles

- `domains/wordpress/standards/checklists` contains WordPress rules; real project facts are local overlays and are never bundled here.
- Workflows select model capabilities, not hardcoded provider/model IDs.
- Third-party provider adapters are independent packages named `pi-<name>`; none is bundled here.
- Credentials, OAuth state, local paths, and machine-specific settings stay outside Git.

## Bootstrap

```bash
./scripts/install.sh
./scripts/doctor.sh
node scripts/verify-workflows.mjs
```

## Create an independent provider adapter

```bash
node scripts/create-adapter.mjs example-provider ../pi-example-provider
cd ../pi-example-provider
npm test
```

The generated project is separate from this repository. Replace its protocol-specific implementation and publish or install it independently. The template includes a Pi provider extension with runtime model discovery via `refreshModels`; use `models.json` instead when the endpoint already speaks a supported API and does not need executable discovery/auth logic.

## Create and list domain tasks

After installing this package in Pi, use the in-session commands:

```text
/task-init <domain> <project> <slug> <title>
/task-list
/task-status <domain>/<project>/<date-slug> <status>
/task-approve <domain>/<project>/<date-slug>
/task-start <domain>/<project>/<date-slug> <plan|implement|review|fix|qa|test|audit|finish>
/task-run <domain>/<project>/<date-slug> <stage>
/task-report <domain>/<project>/<date-slug> <NN-step> <summary>
```

The command refuses to create a task when the matching local project standards file is missing. CLI equivalents are available:

```bash
node scripts/create-task.mjs wordpress sample-site seo-fix "Fix SEO metadata"
PI_TASKS_DIR="$HOME/.pi/tasks" node scripts/list-tasks.mjs
PI_TASKS_DIR="$HOME/.pi/tasks" node scripts/task-transition.mjs wordpress/sample-site/2026-11-14-seo-fix reviewing
```

Lifecycle transitions are validated and invalid jumps are rejected.

## Initialize a local domain project

Create project facts outside this repository:

```bash
PI_STANDARDS_DIR="$HOME/.pi/standards" \
  node scripts/init-project.mjs wordpress sample-site
```

Project facts belong in a private/local standards overlay, not in `pi-workbench`.
