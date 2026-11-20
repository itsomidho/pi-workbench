# Pi Workbench

Pi Workbench is a portable workflow layer for [Pi](https://github.com/earendil-works/pi). It adds domain packs, project standards, approval-gated tasks, stage handoffs, bounded review/fix loops, capability-based model routing, and independent provider adapters.

Pi remains the runtime. Workbench does not bundle a model vendor, copy credentials into projects, or replace Pi's model and extension system.

## Command reference

Angle brackets mark required values; square brackets mark optional arguments. Replace placeholders before running a command. A `<task-id>` is `domain/project/YYYY-MM-DD-slug`; a `<task-directory>` is a filesystem path.

### Installation and diagnostics

| Command | Purpose |
| --- | --- |
| `./scripts/install.sh [--install-dependencies]` | Install Workbench; dependency bootstrap is opt-in. |
| `piw help` | Show shell command help (`--help` and `-h` also work). |
| `piw version` | Show the installed version (`--version` and `-v` also work). |
| `piw doctor` | Diagnose the local installation. |
| `piw check` | Validate the bundled Workbench files. |
| `piw paths` | Print effective XDG, override, and legacy paths. |
| `piw update [--check or --yes]` | Inspect or update an archive installation; `--yes` applies the update. |

### Pi and model routing

| Command | Purpose |
| --- | --- |
| `piw run [Pi arguments…]` | Start Pi in the current project using `router/auto` by default. |
| `piw run --models 'provider/model-a,provider/model-b'` | Limit the models available in this session. |
| `piw run --model provider/model-id` | Select one physical model directly. |
| `piw run --list-models [search]` | List available models and exit. |
| `piw model-capabilities help` | Show policy command help. |
| `piw model-capabilities init [path] [--force]` | Create a policy interactively and print the saved JSON. To replace a file, specify its path before `--force`. |
| `piw model-capabilities list [path]` | Display saved models and stage allowlists. |
| `piw model-capabilities validate [path]` | Check policy structure without contacting providers. |

### Provider adapters

| Command | Purpose |
| --- | --- |
| `piw adapter help` | Show adapter command help. |
| `piw adapter create <name> [destination]` | Generate an adapter package. |
| `piw adapter check <path>` | Validate a local adapter package. |
| `piw adapter install <path>` | Install and register an adapter. |
| `piw adapter configure <provider>` | Save the provider’s local connection settings. |
| `piw adapter health <provider>` | Check endpoint connectivity and authentication. |
| `piw adapter models <provider>` | Query the adapter catalog. |
| `piw adapter list` | List providers with saved environment files. |
| `piw adapter remove <provider>` | Delete the local provider environment file; the adapter package stays installed. |

### Domains and project standards

| Command | Purpose |
| --- | --- |
| `piw domain list` | List installed domain packs. |
| `piw domain check` | Validate manifests and resources. |
| `piw domain detect [project-directory]` | Inspect the specified component (defaults to the current directory). |
| `piw init <domain> <project> [standards-root]` | Create a local project standards file from the domain template. |
| `piw init-from-think <domain> <project> <slug> <think-note>` | Create a planning task from a Think note; this does not approve or start it. |

### Tasks and reports

| Command | Purpose |
| --- | --- |
| `piw task create <domain> <project> <slug> <title>` | Create a task in planning state. |
| `piw task list` | List local tasks and statuses. |
| `piw task status <task-id> <next-status>` | Alias for `piw task transition`; it changes status, not just displays it. |
| `piw task transition <task-id> <next-status>` | Apply an allowed lifecycle transition. |
| `piw task approve <task-id>` | Record explicit approval of the current plan. |
| `piw task artifacts init <task-directory>` | Initialize missing artifact context. |
| `piw task artifacts context <task-directory> <NN-stage>` | Print shared context and the latest brief; the CLI currently requires a stage argument. |
| `piw task artifacts write <task-directory> <NN-stage> <summary>` | Write a manual stage brief; not a managed handoff. |
| `piw report init <slug> <title>` | Create a main-session report workspace. |
| `piw report generate <task-directory> [status] [details.json]` | Write Markdown, JSON, and HTML reports. |

### Inside Pi

| Command | Purpose |
| --- | --- |
| `/think <request>` | Discuss and approve a plan. |
| `/think list` | List saved Think topics. |
| `/think resume [slug]` | Resume a saved Think topic. |
| `/development <request>` | Plan development using the detected domain. |
| `/skill:<name> [arguments]` | Load an installed skill by name. The bundled names are listed below. |
| `go` | Start the exact already-approved managed task if identified in the latest handoff; otherwise pass through as chat. |
| `/router-role <role> [complexity]` | Set routing requirements for the next routed request. |
| `/router-status` | Show the active role, selection, and last physical response model. |
| `/task-go <task-id>` | Start an explicitly identified approved managed task. |
| `/task-go-stop` | Stop after the current turn. |
| `/task-go-resume [task-id]` | Resume the persisted workflow; an ID, if given, must match. |
| `/task-list` | List local tasks in Pi. |
| `/task-init <domain> <project> <slug> <title>` | Create a task in Pi. |
| `/task-status <task-id> <next-status>` | Apply a lifecycle transition. |
| `/task-approve <task-id>` | Record explicit approval of the plan. |
| `/task-start <task-id> <stage>` | Set up a named manual stage and report template. |
| `/task-run <task-id> <stage>` | Run a named manual stage with the active model. |
| `/task-report <task-id> <NN-step> <summary>` | Create a numbered local report. |
| `/reload` | Reload Pi resources and extensions. |

### Bundled skills inside Pi

| Area | Commands |
| --- | --- |
| Think | `/skill:think`, `/skill:think-advisor` |
| Django | `/skill:django-guide`, `/skill:django-development` |
| Laravel | `/skill:laravel-guide`, `/skill:laravel-development` |
| Next.js | `/skill:nextjs-guide`, `/skill:nextjs-development` |
| Nuxt | `/skill:nuxt-guide`, `/skill:nuxt-development` |
| WordPress | `/skill:wordpress-guide`, `/skill:wordpress-development`, `/skill:merge-request-review` |

`piw run` forwards other supported Pi options. Run `piw run --help` for Pi's complete flag reference. See [domain and task commands](docs/domains.md#workbench-commands) and [model selection examples](docs/model-router-usage.md#session-model-scope) for details.

## Requirements

- Node.js `>=22.19.0`
- npm
- Pi
- Git only for the project workflows that need it; Git is not required to install Workbench

## Install for daily use

Consumer installs use a GitHub release archive. No clone and no `.git` directory are required.

```bash
export PI_WORKBENCH_HOME="$HOME/.pi-workbench"
mkdir -p "$PI_WORKBENCH_HOME"
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.21.tar.gz \
  | tar -xz --strip-components=1 -C "$PI_WORKBENCH_HOME"
cd "$PI_WORKBENCH_HOME"
./scripts/install.sh
piw version
piw doctor
piw check
```

Fish equivalent:

```fish
set -gx PI_WORKBENCH_HOME "$HOME/.pi-workbench"
mkdir -p "$PI_WORKBENCH_HOME"
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.21.tar.gz \
  | tar -xz --strip-components=1 -C "$PI_WORKBENCH_HOME"
cd "$PI_WORKBENCH_HOME"
./scripts/install.sh
piw version
piw doctor
piw check
```

The optional bootstrap mode can install Node.js, npm, and Pi on supported apt-based machines:

```bash
./scripts/install.sh --install-dependencies
```

The normal installer does not change system packages.

## Update safely

Run updates outside the project directory so an update cannot be confused by a deleted or changing working directory:

```fish
cd "$HOME"
piw update --yes
piw version
```

`piw update` preserves `$HOME/.pi-workbench`, the global `piw` command, Pi package registration, provider credentials, and runtime data.

## Run Pi

Use `piw run` for normal Workbench usage. It preserves the current project directory and loads saved provider environment files before starting Pi.

```fish
cd "$HOME/projects/my-project"
piw run
```

Use a specific provider and model (replace the sample ID):

```fish
piw run --model provider-a/model-id
```

Limit the models available to the router for this session (replace both model IDs):

```bash
piw run --models 'provider-a/model-id,provider-b/model-id'
```

The saved policy still filters these candidates by stage. `--models` does not edit that policy or set priority. See [session model scope](docs/model-router-usage.md#session-model-scope).

List models from configured adapters:

```fish
piw run --list-models
```

Direct `pi` does not load Workbench provider files. Use `piw run` unless you intentionally provide provider variables yourself.

## Model routing

`router/auto` is the default model selected by `piw run`. It chooses from models exposed by Pi and installed adapters using capability requirements such as tools, reasoning, vision, and context window.

```fish
PI_ROUTER_TRACE=1 piw run
PI_ROUTER_ROLE=debugger piw run
PI_ROUTER_PROVIDER=openai-codex piw run
```

Configure optional role-specific model allowlists with the `piw model-capabilities` commands:

```bash
piw model-capabilities init [path]
piw model-capabilities list [path]
piw model-capabilities validate [path]
```

`init` creates the interactive policy, `list` displays configured models and stage allowlists, and `validate` checks the policy. The default path is `$HOME/.config/pi-workbench/model-capabilities.json`; `PI_MODEL_CAPABILITIES_FILE` or an explicit path can override it. See [docs/model-router-usage.md](docs/model-router-usage.md).

## Provider adapters

Adapters are independent Pi packages named `pi-<provider>`. They live outside the Workbench application by default:

```text
$HOME/.pi-adapters/pi-<provider>
```

The normal lifecycle is:

```fish
piw adapter create example
piw adapter check "$HOME/.pi-adapters/pi-example"
piw adapter install "$HOME/.pi-adapters/pi-example"
piw adapter configure example
piw adapter health example
piw adapter models example
```

Do not run `piw adapter create` again for an existing adapter. Use `check`, `install`, `configure`, `health`, or `models` instead.

See [docs/adapters.md](docs/adapters.md).

## Domain discovery

`/think` and `/development` select a domain from installed packs and repository evidence; they do not default to WordPress. Adding a valid `domains/<id>/domain.json` pack requires no edits to Think or package resource lists. Reload Pi after adding a pack.

```bash
piw domain list
piw domain check
piw domain detect /path/to/project
```

See [docs/domains.md](docs/domains.md) for the manifest contract, adding packs, routing, skill names, and execution limitations. WordPress, Laravel, Django, Next.js, and Nuxt development packs ship with this build. Other stacks require their own packs or an approved main-session fallback.

## Tasks and managed workflows

Initialize a domain project and create a task:

```fish
piw init wordpress my-site
piw task create wordpress my-site seo-fix "Fix SEO metadata"
```

Inside Pi, use `/think` to produce a plan and approve it explicitly. For a prepared managed handoff that identifies an already-approved task, type `go`. If no eligible handoff exists, use the explicit command after approval:

```text
/task-go wordpress/my-site/<date-slug>
```

The workflow can run implementation, review, bounded fix/review loops, QA, tests, audit, and finish. It pauses for missing handoffs, approval, user input, or exceeded limits. Completed, blocked, stopped, and aborted runs produce consistent JSON, Markdown, and offline dark HTML reports:

```text
$HOME/.local/state/pi-workbench/tasks/wordpress/my-site/<date-slug>/FINAL.md
$HOME/.local/state/pi-workbench/tasks/wordpress/my-site/<date-slug>/reports/final.json
$HOME/.local/state/pi-workbench/tasks/wordpress/my-site/<date-slug>/reports/final.html
```

Reports distinguish recorded results, unverified checks, acceptance, risks, and commit/publication/deployment status. Main-session work can use `piw report init <slug> <title>` and `piw report generate <task-directory> <status>` without a framework workflow. See [docs/reports.md](docs/reports.md) for the schema, evidence inputs, privacy limitations, dark UI, and light printing.

Commits, pushes, publishing, merge requests, reset, clean, and other repository actions require explicit user control.

## Data locations

Application files and private runtime data are separate:

```text
$HOME/.pi-workbench                         Workbench application
$HOME/.pi/agent                             Pi runtime and sessions
$HOME/.config/pi-workbench/standards                         Local project standards
$HOME/.local/state/pi-workbench/tasks                             Task state and FINAL.md
$HOME/.pi-adapters/pi-<provider>             Adapter source
$HOME/.config/pi-workbench/providers         Provider env files and CA certificates
$HOME/.config/pi-workbench/model-capabilities.json  Model routing policy
$HOME/.local/state/pi-workbench/think        Think notes
```

Run `piw paths` to see effective paths, including XDG settings, explicit overrides, and legacy fallback. See [runtime locations](docs/installation.md#runtime-locations) before moving any existing files.

Credential files are mode `0600` and are never committed. Do not copy host credentials into a container unless you explicitly intend to configure that container.

## Readiness and limits

Use a verified model/account scope before relying on automatic routing: a healthy catalog can include models blocked by account guardrails. Managed stages are current-session roles, not independent agents. See [docs/readiness.md](docs/readiness.md) for repeatable checks, controlled live workflow validation, and checks that must remain explicitly unverified.

## Development

```bash
git clone https://github.com/itsomidho/pi-workbench.git
cd pi-workbench
npm link --ignore-scripts
pi install "$PWD"
npm test
npm run check
git diff --check
```

See [docs/installation.md](docs/installation.md), [docs/adapters.md](docs/adapters.md), and [docs/troubleshooting.md](docs/troubleshooting.md) for the canonical procedures.
