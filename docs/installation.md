# Installation and updates

## Choose a mode

| Mode | Use when | Git required? |
| --- | --- | --- |
| Release archive | Daily/consumer installation | No |
| Source checkout | Developing Workbench | Yes |
| Disposable bootstrap | Testing on a fresh apt-based machine/container | Optional |

## Consumer installation

A release archive installs the application without repository metadata:

```fish
set -gx PI_WORKBENCH_HOME "$HOME/.pi-workbench"
mkdir -p "$PI_WORKBENCH_HOME"
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.10.tar.gz \
  | tar -xz --strip-components=1 -C "$PI_WORKBENCH_HOME"
cd "$PI_WORKBENCH_HOME"
./scripts/install.sh
piw version
piw doctor
piw check
```

The installer registers the Workbench Pi package and installs the global `piw` command. It does not install system packages in normal mode.

For a disposable apt-based machine:

```fish
./scripts/install.sh --install-dependencies
```

Review that script before using it on a machine you do not control.

## Update

```fish
cd "$HOME"
piw update --check
piw update --yes
hash -r
piw version
```

Updates are archive-based and preserve:

- `$HOME/.pi-workbench`
- the global `piw` command
- Pi package registration
- `$HOME/.pi/agent`
- adapter source and provider credentials

If an update fails, the updater restores the previous application directory when possible. Do not delete runtime data to solve an application update problem.

## Source checkout

```bash
git clone https://github.com/itsomidho/pi-workbench.git
cd pi-workbench
./scripts/install.sh
npm test
npm run check
```

To register a checkout as a Pi package:

```bash
pi install .
```

Consumer installations should not use this mode.

## Runtime locations

Defaults:

```text
$HOME/.pi-workbench                         Installed application
$HOME/.pi/agent                             Pi settings, sessions, auth, MCP state
$HOME/.pi/standards                         Local standards and project facts
$HOME/.pi/tasks                             Task state and artifacts
$HOME/.pi-adapters                          Independent adapter source
$HOME/.config/pi-workbench/providers         Provider env files and CA certificates
```

Override Workbench task/standards locations during installation if required:

```bash
PI_AGENT_DIR="$HOME/.config/pi/agent" \
PI_STANDARDS_DIR="$HOME/.config/pi/standards" \
PI_TASKS_DIR="$HOME/.config/pi/tasks" \
./scripts/install.sh
```

Do not place credentials, OAuth state, project facts, or task state in the repository or application archive.

## Verify a clean installation

```fish
piw version
piw doctor
piw check
pi list
piw adapter list
```

For isolation testing, use a disposable home directory or disposable container. Do not modify production or existing project containers.
