---
name: laravel-development
description: Plan, implement, review, QA, test, and audit approved Laravel changes using the laravel domain pack. Use for non-trivial Laravel features or fixes after domain confirmation; /development is the generic domain-selecting entry point.
---

# Laravel development playbook

## Entry and approval

Read this pack's standards/README.md, the matching local project file, routed checklists, and laravel-guide. Confirm the affected component and installed framework/runtime version. A missing project configuration is a question, not permission to use another project's settings.

Accept the task request or approved Think note as the brief. Record goal, scope, constraints, acceptance criteria, branch conventions, and test environment. Inspect git status read-only; do not stash, reset, switch branches, or discard unrelated work. Reuse settled Think decisions. Present a plan and obtain explicit approval before implementation, task creation, package installation, or repository changes.

For managed execution, create the task with `piw init-from-think laravel <project> <slug> <note>` or `piw task create laravel <project> <slug> <title>`. Copy the approved plan into TASK.md, transition it to awaiting-approval, then record approval with `piw task approve <identifier>`. Start `/task-go <identifier>` only through an actual Pi command capability; otherwise provide that exact command to the user. Never run slash commands in the shell. Do not start a second workflow.

## Stage ownership

workflow.json defines the managed-development-v1 stage contract. The engine owns stage progression, handoffs, and bounded fix loops. Execute only the current requested stage; do not recursively launch the whole playbook. The coordinator owns TASK.md; stage work writes its numbered report and requested workflow_handoff. Current-session roles are not independent agents or enforced read-only boundaries. Disclose unavailable delegation and do not claim independent review.

| Stage | Required outcome |
|---|---|
| plan | Inspect and propose scoped files, data flow, risks, verification, and deployment impact; no implementation. |
| implement | Implement only the approved plan using existing project conventions; record changed files and focused checks. |
| review | Review without editing; evidence-backed findings with severity, file/line, impact, and blocking flag. |
| fix | Address only review findings within approved scope; rerun relevant checks; allow engine re-review. |
| qa | Exercise relevant user/API/browser success/failure, permission, and environment scenarios; record blocked checks. |
| test | Add/run focused regression tests using confirmed test settings and isolated services. |
| audit | Review security, data safety, deployment compatibility, performance, and unresolved findings. |
| finish | Summarize actual evidence, remaining risks, deployment/recovery notes, and approvals still needed. |

## Stack-specific requirements

- Form Requests and validated input, policies and tenant-scoped queries, Eloquent relationships, transactions, jobs dispatched after commit, Blade escaping, route middleware, and additive migrations.
- Check Form Request validation and authorize(), policies/middleware, mass assignment, tenant scoping, bound SQL parameters, Blade escaping, CSRF on browser forms, signed URLs when applicable, and secret/log redaction.
- Review reversible/additive migrations, existing indexes, N+1 queries and eager loading, transaction boundaries, queue retries/idempotency, and dispatch-after-commit behavior. Never run `migrate`, `migrate:fresh`, seeds, queue workers, or scheduled jobs against an unverified environment.
- Use configured PHPUnit or Pest feature tests for authenticated/unauthenticated requests, policies, validation failures, tenant isolation, and query behavior. Fake external services, mail, queues, and storage where appropriate; use a disposable test database.
- Use the project's recorded PHP/Composer/container commands. Typical candidates, not automatic requirements: `php artisan test`, the configured PHPUnit/Pest command, the project's Pint/PHPStan/Larastan checks, and its asset build.

## Stop conditions

Pause for missing project facts, credentials/access, uncertain data safety, scope changes, repeated failures, or unresolved blocking findings. Never fabricate passing tests, browser access, model identity, or independent agent runs. Quality-gate JSON is a checklist, not an arbitrary command runner. Do not commit, push, tag, publish, deploy, migrate production, or open a merge request without separate explicit approval.
