# Django implementation and verification checklist

- Confirm installed runtime/framework versions, first-party scope, and existing architecture before choosing APIs.
- Review additive/reversible migrations, schema/data migration separation, query counts, select_related/prefetch_related, atomic boundaries, uniqueness/race conditions, and transaction.on_commit for side effects. Never run migrate, flush, production management commands, task workers, or external side effects against an unverified environment.
- Use the configured Django test runner or pytest-django. Cover anonymous/authenticated/forbidden requests, object-level permissions, tenant isolation, validation, ORM query counts where relevant, and migrations on disposable databases. Mock external services. Test on_commit behavior with the project's transaction-test approach.
- Preserve route/API contracts, validation errors, localization, timezone, frontend escaping, and deployment compatibility.
- Use the project's recorded Python/virtualenv/container commands. Typical candidates, not automatic requirements: the configured pytest or `python manage.py test`, Ruff/mypy checks, `python manage.py check`, and `python manage.py makemigrations --check --dry-run` against confirmed test settings.
- Report unavailable infrastructure and skipped checks honestly. A mocked runtime workflow test does not validate application behavior.
