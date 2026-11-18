---
name: nuxt-guide
description: "Implementation guidance for Nuxt projects using nuxt in package.json, Vue components, SSR/hydration, useAsyncData/useFetch, Nitro/H3 server routes, route middleware, runtimeConfig, and rendering rules. Read when implementing, reviewing, debugging, or testing this stack; verify versions and project standards first."
---

# Nuxt implementation guide

## Establish the actual stack

Read package.json, its packageManager field, lockfile, nuxt.config.*, app/srcDir layout, modules, server handlers, and tests. Confirm Nuxt/Vue versions, compatibility options, rendering mode, and deployment preset. Nuxt 2/Vue 2, Nuxt Bridge, and Nuxt 3/4 layouts and APIs differ: do not impose Composition API, Nitro, or a newer app/ layout on an older project without an approved migration.

## Components, routing, and SSR

- Follow the existing pages, layouts, components, plugins, composables, middleware, and server directory conventions. Respect configured directories and layers rather than assuming everything belongs at repository root.
- For Nuxt versions that support them, use the existing useAsyncData/useFetch patterns for SSR data and $fetch for appropriate event-driven calls. Avoid duplicate server/client requests, unstable keys, inconsistent server/client defaults, and secrets in serialized payloads.
- Keep composables in valid request/component/plugin context. Do not store request/user state in process-global refs or mutable module singletons; this can leak data between SSR requests. Use version-appropriate request-scoped state and safe unique keys.
- Guard browser-only APIs with version-appropriate client boundaries/plugins. Preserve deterministic markup, hydration, metadata, localization, accessible components, loading/error states, and direct-navigation behavior.

## Server security and runtime configuration

- For Nitro/H3 projects, treat every server route/handler as directly reachable: authenticate, authorize object/tenant access, validate body/query/params, and constrain writable fields. Nuxt route middleware is navigation logic, not a substitute for server authorization. For older Nuxt stacks, inspect their actual serverMiddleware/backend integration instead of inventing Nitro APIs.
- Preserve session/CSRF/origin protections for state-changing operations; cookie options, CORS, redirects, remote fetch targets, and upload constraints need explicit review. Do not assume a framework module supplies protections without checking its configuration.
- Keep private runtimeConfig values on the server. public and app configuration is client-visible; never copy private values into public config, useState/async-data payloads, rendered HTML, error responses, or logs.
- Isolate database operations and side effects appropriately. Do not run migrations, send messages, charge payments, or contact production services during QA without separate permission.

## Rendering, caching, deployment, and verification

- Inspect ssr, routeRules, prerendering, payload extraction, cache keys, Nitro cache utilities, and deployment preset behavior for the installed version. Do not prerender or publicly cache personalized/authenticated output; confirm cache variation and invalidation with multiple users.
- Confirm Node/serverless/Edge/static target constraints and whether server handlers exist on that target. Static generation cannot be treated as a running backend.
- Use existing installed package-manager scripts for typecheck, lint, tests, browser checks, and build. Nuxt Test Utils/Vitest/Playwright are candidates only when installed/configured; Nuxt typecheck may require optional dependencies. Do not silently download packages or assume commands are present.
- Builds and prerendering may execute requests. Confirm a safe test environment first. Verify direct URL reload plus client navigation, hydration, loading/error states, API auth/denial, responsive/accessibility behavior, and payload/cache isolation. Report unavailable services and skipped checks.
