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
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.13.tar.gz \
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

The updater stages the application on its target filesystem, validates archive identity/version, and snapshots the previous package and Pi registration before replacement. Command failures trigger restoration of the application, global CLI, and registration. If rollback itself fails, it exits nonzero and prints retained recovery paths; do not delete those files until recovery is complete. Do not delete runtime data to solve an application update problem. Avoid concurrent package/settings changes while updating.

Both the executing installation and the selected update target are protected when they contain Git metadata. Normal lifecycle tests use real npm and Pi in disposable homes/prefixes with stubbed release transport; live GitHub release creation and system dependency bootstrap are separate operations.

## Source checkout

```bash
git clone https://github.com/itsomidho/pi-workbench.git
cd pi-workbench
npm test
npm run check
```

For active development, use the checkout as the single source of truth instead of copying it into the global npm directory:

```bash
cd /path/to/pi-workbench
npm link --ignore-scripts
pi install "$PWD"
```

Check `pi list` and remove any older Workbench application registration with `pi remove <old-source>` (not provider adapters). Keep exactly one Workbench package registration. `npm link` makes the global `piw` command resolve to this checkout; Pi must load that same checkout. Existing release-archive directories can be retained as inactive backups.

Verify both paths and the new commands:

```bash
type -a piw
readlink -f "$(command -v piw)"
pi list
piw version
piw domain list
piw domain check
```

If you want only Workbench skills, exclude auto-discovered user skills with `"skills": ["!skills/**"]` in the Pi agent settings, leaving the Workbench package registered. Auto-discovered Agent Skills patterns resolve against the `.agents` resource base, so an agent-directory-relative path such as `!../../.agents/skills/**` does not reliably exclude them. Package and extension-provided skills remain available. Project/package-specific resource filters may still need separate configuration.

Run `/reload` in existing Pi sessions after changing registration or source files. No reinstall is needed for ordinary edits in a linked checkout. `scripts/install.sh` remains the regular installer and may create a copied global package; rerun `npm link --ignore-scripts` if switching back to linked development.

`piw update` refuses to run from a Git checkout. Update source with Git only after reviewing local changes, then rerun the checks. Do not use an archive update to replace development work. A `-dev` version is local/unreleased, not evidence of a published release.

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

Override Workbench task/standards locations during installation if required. `PI_AGENT_DIR` is a Workbench installer alias for Pi's actual `PI_CODING_AGENT_DIR`; an explicitly set `PI_CODING_AGENT_DIR` takes precedence. The chosen directory is exported to Pi for registration:

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
