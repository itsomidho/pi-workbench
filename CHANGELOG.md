# Changelog

## 0.5.14-dev.0 - Unreleased

- Generate one evidence-backed task report as JSON, Markdown, and self-contained dark HTML with responsive navigation, accessible states, and light printing.
- Produce reports for completed, blocked, stopped, aborted, and missing-handoff managed runs; add report-only main-session CLI support.
- Scope report evidence to the current run, preserve unknown verification/acceptance/delivery states, escape output, and redact common secrets.
- Discover and validate domain packs dynamically; route Think and development using repository evidence and explicit manifest entries.
- Load selected domain role instructions in managed stages and preserve explicit task identifiers for execution.
- Add domain CLI commands, multi-domain tests, and domain authoring documentation.
- Ship baseline Laravel, Django, Next.js, and Nuxt development packs with guides, standards, role profiles, and safe stack detection.
- Detect Next.js/Nuxt by package dependencies, not React/Vue or configuration filenames; cover both packs in real Pi command-discovery and mock-workflow tests.
- Check plan approval on start, continuation, and resume; pause aborted runs and later-stage blocking findings.
- Correct handoff selection for skipped fix stages and re-review after fixes.
- Document a linked source-checkout installation and prevent archive updates from replacing a linked development checkout.
- Confirm workflow role updates through the registered router's event bus rather than isolated module imports.
- Treat corrupt handoffs as bounded failures and omit malformed optional report records with warnings.
- Correct WordPress pack reference paths and separate bundled baseline rules from private project facts.
- Handle source/install paths containing spaces in structural validation and the source-update guard.
- Restore the application, global CLI, and Pi registration after failed updates; retain recovery archives if rollback fails, and guard Git update targets as well as linked commands.
- Honor custom Pi agent directories in the installer and add real isolated npm/Pi lifecycle coverage.
- Recognize native SDK tool transports (including Codex, Azure, Bedrock, Vertex, Mistral, and Pi messages); fail closed on missing or insufficient context metadata.
- Correct WordPress REST guidance: missing permission callbacks do not prevent registration, and custom sanitizers need explicit schema validation callbacks.

## 0.5.13 - 2026-11-16

- Align think skill and workflow approval gates, advisor boundaries, and coordinator-only fallback disclosure.
- Make session router-role changes override the initial environment role consistently.
- Report effective role, selected model, and branch-local physical response metadata separately.
- Reject unknown router roles explicitly and clarify that capability profiles do not enforce tool permissions.
- Add regression coverage for router behavior and think instruction contracts.

## 0.5.12 - Unreleased

- Resolve adapter base URLs before Pi sends model requests.
- Fix `Invalid URL` failures for dynamic provider adapters.

## 0.5.11 - Unreleased

- Recover safely when `piw` is launched from a deleted working directory.

## 0.5.10 - Unreleased

- Discover dynamic adapter models during Pi startup.
- Keep adapter refresh available for explicit model-catalog refreshes.

## 0.5.9 - Unreleased

- Complete adapter npm installation before Pi registration.
- Ensure `piw adapter install` registers the adapter package in Pi.

## 0.5.8 - Unreleased

- Write adapter credential files with real newlines.
- Read and recover credential files that contain literal `\\n` separators.

## 0.5.7 - Unreleased

- Show a clear existing-adapter message instead of a raw stack trace.
- Make hidden adapter credential prompts reliable in Fish, tmux, and interactive terminals.

## 0.5.6 - Unreleased

- Keep the public adapter configuration namespace provider-specific, such as `TABDL_*`.
- Prompt for an optional CA certificate path and apply it to adapter health and Pi runs.

## 0.5.5 - Unreleased

- Replace readline hidden input with raw terminal input so API keys are never echoed.
- Fix literal `\\n` output after hidden credential prompts.

## 0.5.4 - Unreleased

- Prevent hidden adapter API keys from being echoed by readline in interactive terminals.

## 0.5.3 - Unreleased

- Run Pi registration updates from a stable home directory during `piw update`.
- Prevent consumer updates from failing when the application directory is replaced.

## 0.5.2 - Unreleased

- Fix hidden API-key input in interactive adapter configuration on tmux and LXD terminals.
- Restore terminal echo reliably after credential prompts.

## 0.5.1 - Unreleased

- Store generated adapters in `$HOME/.pi-adapters` by default.
- Keep adapter source separate from the Workbench installation and project directories.

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
