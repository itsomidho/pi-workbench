---
name: laravel-guide
description: "Implementation guidance for Laravel projects: artisan, laravel/framework, Eloquent models, Form Requests, policies, middleware, Blade, jobs, queues, and Laravel application tests. Read when implementing, reviewing, debugging, or testing this stack; confirm versions and project standards first."
---

# Laravel implementation guide

Read the repository's composer.json/lock, application bootstrap, tests, and local project standards before choosing APIs. Laravel/PHP versions and application structure vary: do not impose a new-version layout on an older app.

## Requests and authorization

- Follow the existing route, middleware, controller/service, and response conventions. Keep transport code thin without introducing unnecessary abstraction layers.
- Validate with the existing Form Request/validator pattern and consume only validated fields. Authorization is separate from validation: enforce policies/gates and resource/tenant scoping on reads and writes.
- Keep CSRF for session/browser mutations. API authentication must follow the project's actual guard (for example Sanctum), not an invented one.
- Return API Resources or established response types; preserve pagination, status codes, and backward compatibility.

## Data and async work

- Use Eloquent/query-builder parameter binding. Review fillable/guarded fields, serialized attributes, sensitive data exposure, eager loading, and indexes.
- Keep multi-step invariants inside appropriate transactions. Use locks only when needed and account for retries/deadlocks.
- Make queued jobs idempotent; dispatch after commit where database state is required. Do not perform real third-party calls or start workers without the approved environment.
- Treat schema changes as deployment operations. Design additive transitions and rollback/forward recovery; discuss large-table lock risks.

## Output and verification

- Use Blade's escaped output for untrusted content; raw output requires a justified sanitizer/trust boundary. Preserve localization and frontend conventions.
- Record exact tests/builds actually run and their exit codes. Never claim authorization, database, queue, or browser coverage based on code inspection alone.
