# JavaScript checklist (front end and admin, not build output)

## Security
- `innerHTML`, `insertAdjacentHTML`, `outerHTML`, jQuery `.html()` / `$(htmlString)` with data from the URL, an API, `localStorage`, or CMS content → XSS. Use `textContent` / DOM creation, or sanitize.
- No secrets in front-end code (API keys end up in the public bundle).
- AJAX/REST writes send the nonce (`wp_localize_script` / `wpApiSettings.nonce` / `X-WP-Nonce`).
- `postMessage` handlers check `event.origin`.
- On a shared origin (see the project file), `localStorage`/`sessionStorage` keys are namespaced per site, and JS cookies set an explicit `path`; otherwise sibling apps on the same domain read or overwrite them. Flag new un-namespaced keys; existing shared keys may be intentional (ask, don't assume).

## Correctness
- Code waits for the DOM (`DOMContentLoaded`, `defer`, or module scripts) and null-checks `querySelector` results. A component script loaded on every page must not throw on pages where its markup is absent: one uncaught error stops the rest of the bundle.
- `fetch` checks `response.ok` before `response.json()`, and handles network failure.
- Async race conditions: stale responses overwriting newer ones (search-as-you-type), no `AbortController` where requests can overlap.
- Event delegation for content injected later (AJAX-loaded posts, infinite scroll), otherwise new elements get no listeners.
- Endpoint and asset URLs come from PHP (`wp_localize_script` / `wp_add_inline_script` with `rest_url()`, `admin_url('admin-ajax.php')`, `wpApiSettings.root`), never hardcoded `'/wp-json/…'` or `'/wp-admin/admin-ajax.php'`: those break when the site runs in a sub-path (see `wordpress-core.md` → URLs and paths).
- Strict equality; no reliance on implicit type coercion for IDs from `dataset` (always strings).
- Active/current navigation state is decided by comparing normalized paths for equality, never by a substring check like `location.href.includes(link)`; build the comparison from WordPress's home URL (passed from PHP) so it works under a sub-path. (added 2026-10-06)

## Performance and memory
- Listeners, intervals, observers and timers added in components that can be torn down are removed/disconnected.
- Scroll/resize handlers are throttled/debounced or replaced with `IntersectionObserver` / `ResizeObserver`; listeners marked `{ passive: true }` where they don't `preventDefault`.
- Layout thrashing: reading layout (`offsetHeight`, `getBoundingClientRect`) inside loops that also write styles.
- Heavy libraries imported for a small use (whole lodash, moment.js): suggest a targeted import or native API. Dynamic `import()` for code needed only on some pages.

## i18n and RTL
- User-facing strings in JS are translatable (`wp.i18n.__` with `wp_set_script_translations`, or passed in from PHP), not hardcoded English/Persian in code.
- Direction-sensitive logic (carousels, swipe, `scrollLeft`, arrow-key navigation, positioning) works under `dir="rtl"`. `scrollLeft` is negative in RTL in modern browsers.
- Dates/numbers formatted with `Intl` using the site locale, not hardcoded formats.

## Quality
- No `console.log` / `debugger` left in.
- Follows the module style already in the codebase (ES modules vs globals, jQuery vs vanilla). Don't suggest a rewrite to a different style.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/performance.md` (front-end section)
