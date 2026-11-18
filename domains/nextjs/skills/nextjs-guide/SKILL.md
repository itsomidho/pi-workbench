---
name: nextjs-guide
description: "Implementation guidance for Next.js projects using next in package.json, App Router or Pages Router, React Server Components, Server Actions, route handlers, SSR/SSG, caching, and hydration. Read when implementing, reviewing, debugging, or testing this stack; verify versions and project standards first."
---

# Next.js implementation guide

## Establish the actual stack

Read package.json, its packageManager field, lockfile, next.config.*, tsconfig, routes, and tests. Confirm installed Next.js/React versions, App Router or Pages Router, src/ layout, deployment target, and Node versus Edge runtime. Config or directory names alone do not prove a framework version. Do not upgrade versions or migrate routers implicitly.

## Routing and rendering

- In App Router, follow existing app/ or src/app/ conventions for pages, layouts, route handlers, loading, error, and not-found boundaries. In Pages Router, retain pages/, API routes, and the project's getServerSideProps/getStaticProps strategy; do not introduce App Router APIs indiscriminately.
- Keep Server Components as server-only code. Add 'use client' only at the necessary interactive boundary; account for its transitive client imports and serializable props. Do not import server-only SDKs, filesystem access, secrets, or database clients into client code.
- Derive request APIs, route parameters, cookies/headers usage, middleware versus proxy conventions, and caching defaults from the installed version. Some APIs are asynchronous or renamed in newer releases; do not assume latest behavior in older code.
- Avoid non-deterministic server/client output, browser globals during SSR, and hydration mismatches. Preserve metadata, accessible semantic HTML, localization, image/font handling, and existing error/loading UX.

## Server security and data isolation

- Treat Server Actions, Route Handlers, Pages API routes, and server-side data access as directly reachable entry points. Authenticate and authorize every operation and object/tenant access. A hidden button, guarded page/layout, or middleware/proxy check alone is insufficient.
- Validate input and constrain writable fields, upload sizes/types, redirects, and remote fetch targets. Preserve framework origin/CSRF protections; do not disable them to make a test pass.
- Keep secrets in server-only code. NEXT_PUBLIC_* values are public, and even non-public variables can leak if copied into props, HTML, RSC payloads, errors, or logs.
- Preserve database transaction boundaries and side-effect idempotency. Do not run migrations, send real messages, charge payments, or invoke production services under a QA label.

## Cache, deployment, and verification

- Explicitly reason about static versus request-specific output, fetch/data caches, cache keys, invalidation/revalidation, and tenant/user scope. Never share personalized or authenticated data across users. Caching defaults differ across Next.js versions; inspect configuration and actual behavior.
- Confirm whether the target is a Node server, Edge environment, serverless adapter, or static export. Server Actions, server routes, filesystem access, and revalidation may not be available on every target.
- Use the repository's installed package manager and scripts for lint/typecheck, unit/component/integration tests, browser tests, and build. Do not assume next lint exists or use a package runner that silently downloads tools.
- Builds can execute data fetching or static generation. Confirm test env and mock external services before building. Test client navigation and direct URL reload, loading/error states, authenticated/denied requests, hydration, responsive/accessibility behavior, and cache isolation. Record missing coverage honestly.
