# Next.js security checklist

- Authorize each Server Action, Route Handler, API route, and server-side data operation independently; page guards or middleware/proxy checks alone are not an authorization boundary. Validate untrusted input, scope data to the user/tenant, and prevent secrets from entering client bundles, rendered HTML, serialized props, or RSC payloads.
- Exercise anonymous, denied, object-owner/non-owner, and different-tenant cases, not only success paths.
- Review XSS and raw HTML, CSRF/session protections, CORS/cookies, redirect targets, remote URL fetching, and upload size/type/access rules.
- Check server/client boundaries and public environment/config values, serialized payloads, logs, error pages, and static artifacts for leaks.
- Verify that shared caches and prerendered output cannot expose authenticated or personalized data.
- Do not disable security controls for convenience or run real external/production effects as tests.
