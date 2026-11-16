# Pi Workbench

Pi Workbench is a portable workflow layer for [Pi](https://github.com/earendil-works/pi). It adds domain packs, project standards, approval-gated tasks, stage handoffs, bounded review/fix loops, capability-based model routing, and independent provider adapters.

Pi remains the runtime. Workbench does not bundle a model vendor, copy credentials into projects, or replace Pi's model and extension system.

## What to use

| Need | Command |
| --- | --- |
| Install or update Workbench | `./scripts/install.sh` or `piw update --yes` |
| Check the installation | `piw doctor` and `piw check` |
| Configure a provider | `piw adapter configure <name>` |
| See provider models | `piw adapter models <name>` |
| Run Pi with saved provider credentials | `piw run ...` |
| Let Workbench choose a capable model | `piw run` |
| Start a task | `/think`, approval, then `/task-go ...` inside Pi |

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
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.13.tar.gz \
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
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.13.tar.gz \
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
hash -r
piw version
```

`piw update` preserves `$HOME/.pi-workbench`, the global `piw` command, Pi package registration, provider credentials, and runtime data.

## Run Pi

Use `piw run` for normal Workbench usage. It preserves the current project directory and loads saved provider environment files before starting Pi.

```fish
cd "$HOME/projects/my-project"
piw run
```

Use a specific provider and model:

```fish
piw run --provider tabdl --model cx/gpt-6.1-sol
```

List models from configured adapters:

```fish
piw run --list-models
```

Direct `pi` does not load Workbench provider files. Use `piw run` unless you intentionally provide `TABDL_*` or other provider variables yourself.

## Model routing

`router/auto` is the default model selected by `piw run`. It chooses from models exposed by Pi and installed adapters using capability requirements such as tools, reasoning, vision, and context window.

```fish
PI_ROUTER_TRACE=1 piw run
PI_ROUTER_ROLE=debugger piw run
PI_ROUTER_PROVIDER=tabdl piw run
```

See [docs/model-router-usage.md](docs/model-router-usage.md).

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

See [docs/adapters.md](docs/adapters.md) and [docs/tabdl.md](docs/tabdl.md).

## Tasks and managed workflows

Initialize a domain project and create a task:

```fish
piw init wordpress my-site
piw task create wordpress my-site seo-fix "Fix SEO metadata"
```

Inside Pi, use `/think` to produce a plan. Approve the plan explicitly, then start the managed workflow:

```text
/task-go wordpress/my-site/<date-slug>
```

The workflow can run implementation, review, bounded fix/review loops, QA, tests, audit, and finish. It pauses for missing handoffs, approval, user input, or exceeded limits. A completed task writes:

```text
$HOME/.pi/tasks/wordpress/my-site/<date-slug>/FINAL.md
```

Commits, pushes, publishing, merge requests, reset, clean, and other repository actions require explicit user control.

## Data locations

Application files and private runtime data are separate:

```text
$HOME/.pi-workbench                         Workbench application
$HOME/.pi/agent                             Pi runtime and sessions
$HOME/.pi/standards                         Local project standards
$HOME/.pi/tasks                             Task state and FINAL.md
$HOME/.pi-adapters/pi-<provider>             Adapter source
$HOME/.config/pi-workbench/providers         Provider env files and CA certificates
```

Credential files are mode `0600` and are never committed. Do not copy host credentials into a container unless you explicitly intend to configure that container.

## Development

```bash
git clone https://github.com/itsomidho/pi-workbench.git
cd pi-workbench
./scripts/install.sh
npm test
npm run check
git diff --check
```

See [docs/installation.md](docs/installation.md), [docs/adapters.md](docs/adapters.md), and [docs/troubleshooting.md](docs/troubleshooting.md) for the canonical procedures.
