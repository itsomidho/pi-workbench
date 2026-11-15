# Changelog

## 0.5.0 - Unreleased

- Add adapter check, install, configure, health, models, list, and remove commands.
- Add secure interactive provider credential storage outside repositories.
- Load configured provider credentials automatically for direct runs and router model discovery.
- Support dynamic model catalogs with configurable paths and static model catalogs.
- Add adapter lifecycle documentation.

## 0.4.3 - Unreleased

- Load WordPress workflow skills, including `merge-request-review`, in Pi.

## 0.4.2 - Unreleased

- Fix the primary `piw run` path to preserve the caller's working directory.

## 0.4.1 - Unreleased

- Install updates from an npm package archive so the global `piw` binary never points into a deleted temporary directory.
- Preserve the final application directory while refreshing Pi registration.

## 0.4.0 - Unreleased

- Preserve the caller's working directory when launching Pi with `piw run`.
- Keep Workbench installation files separate from the project being worked on.

## 0.3.9 - Unreleased

- Preserve the consumer application directory during `piw update`.
- Register a temporary copy with Pi so Pi installation cannot empty the source directory.

## 0.3.8 - Unreleased

- Preserve explicit `--model` values passed through `piw run`.

## 0.3.7 - Unreleased

- Add `piw run` as the Workbench entry point with `router/auto` as the default model.
- Pass through Pi arguments while preserving explicit model selection.

## 0.3.6 - Unreleased

- Fix `piw update --check` and `piw update --yes` argument routing.

## 0.3.5 - Unreleased

- Make `install.sh` install the `piw` CLI globally and register the Workbench package with Pi.

## 0.3.4 - Unreleased

- Install Node.js 22 when bootstrapping dependencies so Pi's runtime requirement is satisfied.
- Fail clearly when an existing Node.js version is too old for Pi.

## 0.3.3 - Unreleased

- Add opt-in dependency bootstrap for apt-based systems.
- Add `piw update` and `piw update --check` for release-archive installations.

## 0.3.2 - Unreleased

- Fix consumer reinstall guidance when an older global `piw` binary is already present.
- Ensure the release archive and CLI report the same package version.

## 0.3.0 - Unreleased

- Added think-note to domain task handoff.
- Added shared task context and compact stage handoff briefs.
- Added plan approval hashes and approval enforcement.
- Added managed implement, review, fix, QA, test, audit, and finish orchestration.
- Added bounded review/fix loops, retry handling, resume state, usage tracking, and final reports.
- Added domain manifests and quality-gate configuration.
- Added Pi RPC integration tests with a deterministic streaming mock provider.
- Added workflow protections against concurrent runs and repository/release commands.

## 0.2.0 - 2026-11-15

- Added the `piw` command-line interface.
- Added domain-aware project and task commands.
- Added the initial Pi Workbench task lifecycle and adapter tooling.
