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
curl -L https://github.com/itsomidho/pi-workbench/archive/refs/tags/v0.5.20.tar.gz \
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

Run `piw paths` to print effective Workbench paths. Defaults for a fresh install:

| Data | Default | Explicit override |
|---|---|---|
| Model policy | `~/.config/pi-workbench/model-capabilities.json` | `PI_MODEL_CAPABILITIES_FILE` |
| Provider environment files and CA certificates | `~/.config/pi-workbench/providers/` | `PI_WORKBENCH_CONFIG_DIR` (the providers directory itself) |
| Local project standards | `~/.config/pi-workbench/standards/` | `PI_STANDARDS_DIR` |
| Tasks, reports, and evidence | `~/.local/state/pi-workbench/tasks/` | `PI_TASKS_DIR` |
| Think notes | `~/.local/state/pi-workbench/think/` | `PI_THINK_DIR` |

Absolute `XDG_CONFIG_HOME` and `XDG_STATE_HOME` replace `~/.config` and `~/.local/state`, respectively. Relative or empty XDG values are ignored. Explicit Workbench overrides take precedence; the CLI model-policy commands also accept an explicit path argument.

For each item, if the new location is absent and the old one exists, Workbench continues to use the old one, including for writes. The legacy locations are `~/.pi/{model-capabilities.json,standards,tasks,think}` and `~/.config/pi-workbench/providers/` (when using a custom XDG configuration home). If both exist, the new location wins unless explicitly overridden; contents are never merged. Nothing is moved or copied automatically. Before migrating manually, stop active workflows, back up the source, and check for absolute paths in task and provider configuration (including CA and note references). Verify the resulting paths with `piw paths`.

Application source, adapter source, and Pi's own settings are unchanged. `PI_AGENT_DIR` is a Workbench installer alias for Pi's `PI_CODING_AGENT_DIR`; an explicitly set `PI_CODING_AGENT_DIR` takes precedence.

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
