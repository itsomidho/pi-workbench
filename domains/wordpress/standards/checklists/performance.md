# Performance checklist

## Database
- N+1: per-item queries inside loops (`get_post_meta`, `get_the_terms`, `get_field`, `get_user_by` per post). Suggest priming caches (`update_post_meta_cache`, `update_post_term_cache`, `_prime_post_caches`) or one batched query.
- `WP_Query` hygiene: `no_found_rows => true` when the total count isn't needed; `fields => 'ids'` when only IDs are used; `update_post_meta_cache`/`update_post_term_cache => false` when unused.
- `posts_per_page => -1` / `numberposts => -1` on unbounded sets.
- `meta_query` / `orderby => meta_value` on unindexed keys, `LIKE '%…%'` on meta values, and `NOT IN` on large sets: slow on big tables.
- Custom tables have indexes on the columns the new queries filter and join on.
- Writes in loops: batch them, or at least suspend cache invalidation (`wp_suspend_cache_invalidation`, `wp_defer_term_counting`).

## Request path
- Remote calls (APIs, AI/LLM calls, feeds) never run uncached on a page load. Cache the result with a TTL, or move to cron / async.
- Expensive work runs only where needed: check conditionals (`is_singular`, admin screen) before loading data or assets.
- Autoloaded options stay small; no large arrays in autoloaded options.
- Object cache / transients used for repeated expensive computations, with sensible keys (see `wordpress-core.md`).
- Cache keys built from request input (query string, slug, REST param) are resolved to a real entity first (term, post, allow-list) and keyed on its canonical value. Unknown input writes nothing: otherwise random values bypass the page cache and fill `wp_options` / the object cache, and case variants get keys that invalidation never clears. (added 2026-11-01)

## Front end
- Scripts loaded with `defer`/`async` or in the footer; not enqueued on every page when used on one.
- Images: `wp_get_attachment_image()` with sizes/srcset, `loading="lazy"` except for the LCP image (which should be eager, ideally with `fetchpriority="high"`).
- No render-blocking third-party scripts added to `<head>`.
- Bundle size: large new dependencies or whole-library imports (see `javascript.md`).

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/performance.md`
