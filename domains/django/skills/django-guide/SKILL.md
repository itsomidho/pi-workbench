---
name: django-guide
description: "Implementation guidance for Django projects: manage.py, Django models/forms/views/URLconf, admin, ORM, middleware, migrations, Django REST Framework, and pytest-django tests. Read when implementing, reviewing, debugging, or testing this stack; confirm versions and project standards first."
---

# Django implementation guide

Read the repository's dependency/lock files, manage.py, settings selection, apps, and tests first. Confirm Python/Django/DRF versions and the virtualenv or container command; do not assume a global interpreter or database.

## Requests and permissions

- Follow existing URLconf, function/class-based view, service, form, and response conventions. DRF is optional: use serializers/ViewSets only if the project uses it.
- Validate with forms/model forms or established serializers and explicitly allow writable fields. Never infer authorization from a valid form.
- Apply authentication plus object-level authorization and tenant/user-scoped querysets. Session-authenticated mutations retain CSRF protection, including DRF session authentication.
- Preserve API pagination, status codes, error shapes, and backwards compatibility.

## ORM, migrations, and tasks

- Use ORM parameterization; avoid interpolated SQL. Review select_related/prefetch_related, indexes, query counts, constraints, and bulk-operation signal behavior.
- Use transaction.atomic where an invariant spans writes; reason about race conditions, uniqueness errors, and select_for_update only with the actual database semantics.
- Use transaction.on_commit for side effects that depend on committed state. Celery is optional, not a Django default; make background tasks idempotent when present.
- Keep migrations additive where possible, separate schema/data work, and account for large-table locks and deployment order. Never run real migrations or flush without explicit environment approval.

## Output and verification

- Preserve template autoescape; mark_safe and safe filters need a justified sanitizer/trust boundary. Review upload handling, static/media boundaries, localization, and timezone-aware dates.
- Use test settings and disposable test databases. Some checks import project settings and may connect to services; confirm configuration before running even check commands.
- Record tests and commands actually executed. Inspection is not proof that authentication, database, async, or browser scenarios passed.
