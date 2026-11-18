---
name: django-development
description: Plan, implement, review, QA, test, and audit approved Django changes using the django domain pack. Use for non-trivial Django features or fixes after domain confirmation; /development is the generic domain-selecting entry point.
---

# Django development playbook

## Entry and approval

Read this pack's standards/README.md, the matching local project file, routed checklists, and django-guide. Confirm the affected component and installed framework/runtime version. A missing project configuration is a question, not permission to use another project's settings.

Accept the task request or approved Think note as the brief. Record goal, scope, constraints, acceptance criteria, branch conventions, and test environment. Inspect git status read-only; do not stash, reset, switch branches, or discard unrelated work. Reuse settled Think decisions. Present a plan and obtain explicit approval before implementation, task creation, package installation, or repository changes.

For managed execution, create the task with `piw init-from-think django <project> <slug> <note>` or `piw task create django <project> <slug> <title>`. Copy the approved plan into TASK.md, transition it to awaiting-approval, then record approval with `piw task approve <identifier>`. Start `/task-go <identifier>` only through an actual Pi command capability; otherwise provide that exact command to the user. Never run slash commands in the shell. Do not start a second workflow.

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

- Django forms/serializers, permission and tenant-scoped querysets, ORM relationships, atomic transactions, on_commit callbacks, template escaping, additive migrations, and Django test isolation.
- Check CSRF for session/browser mutations, authentication and object-level permissions, queryset tenant scoping, forms/serializer allowlists, ORM parameter binding, autoescaping, upload limits, secure settings, and secret/log redaction.
- Review additive/reversible migrations, schema/data migration separation, query counts, select_related/prefetch_related, atomic boundaries, uniqueness/race conditions, and transaction.on_commit for side effects. Never run migrate, flush, production management commands, task workers, or external side effects against an unverified environment.
- Use the configured Django test runner or pytest-django. Cover anonymous/authenticated/forbidden requests, object-level permissions, tenant isolation, validation, ORM query counts where relevant, and migrations on disposable databases. Mock external services. Test on_commit behavior with the project's transaction-test approach.
- Use the project's recorded Python/virtualenv/container commands. Typical candidates, not automatic requirements: the configured pytest or `python manage.py test`, Ruff/mypy checks, `python manage.py check`, and `python manage.py makemigrations --check --dry-run` against confirmed test settings.

## Stop conditions

Pause for missing project facts, credentials/access, uncertain data safety, scope changes, repeated failures, or unresolved blocking findings. Never fabricate passing tests, browser access, model identity, or independent agent runs. Quality-gate JSON is a checklist, not an arbitrary command runner. Do not commit, push, tag, publish, deploy, migrate production, or open a merge request without separate explicit approval.
