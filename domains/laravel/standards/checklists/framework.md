# Laravel implementation and verification checklist

- Confirm installed runtime/framework versions, first-party scope, and existing architecture before choosing APIs.
- Review reversible/additive migrations, existing indexes, N+1 queries and eager loading, transaction boundaries, queue retries/idempotency, and dispatch-after-commit behavior. Never run `migrate`, `migrate:fresh`, seeds, queue workers, or scheduled jobs against an unverified environment.
- Use configured PHPUnit or Pest feature tests for authenticated/unauthenticated requests, policies, validation failures, tenant isolation, and query behavior. Fake external services, mail, queues, and storage where appropriate; use a disposable test database.
- Preserve route/API contracts, validation errors, localization, timezone, frontend escaping, and deployment compatibility.
- Use the project's recorded PHP/Composer/container commands. Typical candidates, not automatic requirements: `php artisan test`, the configured PHPUnit/Pest command, the project's Pint/PHPStan/Larastan checks, and its asset build.
- Report unavailable infrastructure and skipped checks honestly. A mocked runtime workflow test does not validate application behavior.
