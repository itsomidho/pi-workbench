# Nuxt security checklist

- Authorize each Nitro/H3 handler or other server entry point and scope data to the user/tenant; client navigation middleware and hidden UI are not server security boundaries. Validate input and protect session mutations. Keep secrets out of public runtimeConfig, client bundles, rendered HTML, and serialized Nuxt payloads.
- Exercise anonymous, denied, object-owner/non-owner, and different-tenant cases, not only success paths.
- Review XSS and raw HTML, CSRF/session protections, CORS/cookies, redirect targets, remote URL fetching, and upload size/type/access rules.
- Check server/client boundaries and public environment/config values, serialized payloads, logs, error pages, and static artifacts for leaks.
- Verify that shared caches and prerendered output cannot expose authenticated or personalized data.
- Do not disable security controls for convenience or run real external/production effects as tests.
