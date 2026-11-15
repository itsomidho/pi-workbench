# Changelog

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
