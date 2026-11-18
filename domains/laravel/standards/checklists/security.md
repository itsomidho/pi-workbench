# Laravel security checklist

- Check Form Request validation and authorize(), policies/middleware, mass assignment, tenant scoping, bound SQL parameters, Blade escaping, CSRF on browser forms, signed URLs when applicable, and secret/log redaction.
- Exercise denied/anonymous/object-owner/non-owner cases, not just successful requests.
- Protect secrets and personal data in responses, logs, exceptions, configuration, and test fixtures.
- Validate upload type, size, destination, and access policy. Do not expose arbitrary filesystem or network access.
- Preserve existing security middleware and rate/abuse controls. Document assumptions about proxies, HTTPS, cookies, CORS, and sessions.
- Do not access production data, run destructive commands, or send external effects under the label of testing.
