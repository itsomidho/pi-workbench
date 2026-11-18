# Django security checklist

- Check CSRF for session/browser mutations, authentication and object-level permissions, queryset tenant scoping, forms/serializer allowlists, ORM parameter binding, autoescaping, upload limits, secure settings, and secret/log redaction.
- Exercise denied/anonymous/object-owner/non-owner cases, not just successful requests.
- Protect secrets and personal data in responses, logs, exceptions, configuration, and test fixtures.
- Validate upload type, size, destination, and access policy. Do not expose arbitrary filesystem or network access.
- Preserve existing security middleware and rate/abuse controls. Document assumptions about proxies, HTTPS, cookies, CORS, and sessions.
- Do not access production data, run destructive commands, or send external effects under the label of testing.
