# Full-page cache checklist (Nginx FastCGI cache and similar)

Load this when the project file says the site runs behind a full-page cache. On such a site, the first anonymous visitor's HTML is served to everyone until the TTL expires or a purge runs. Code that is correct on an uncached site can be wrong here.

Logged-in users, POST requests and the skip rules defined on the server normally bypass the cache. Check the project file before assuming a path is or isn't cached.

## Per-visitor content in cached HTML
- Anything that varies per visitor inside a cached page gets frozen for every visitor until the TTL ends. This includes reading `$_COOKIE`, `$_SERVER['REMOTE_ADDR']`, geo/IP data, `is_user_logged_in()` output for anonymous users, `wp_get_current_user()` data, A/B buckets, `rand()`/`shuffle`, "recently viewed", and CSRF tokens tied to a session. 🔴 if it leaks one visitor's data to others; otherwise 🟡.
- Fix options: load that part client-side (REST/AJAX that bypasses the cache), or mark the response uncacheable (`nocache_headers()`, or a cookie/URI the server's skip rules honor) only where it's really needed.

## Time-sensitive output
- Countdowns, "X minutes ago", prices/rates, live news, and opening/closing states rendered in PHP can be up to one TTL old. Acceptable only if a TTL-old value is fine. Otherwise render the time in JS from a timestamp, or fetch live data client-side.
- Scheduled posts and expiring content: the cached archive/home still shows the old state until a purge or the TTL ends.

## Nonces and forms on cached pages
- A nonce printed into a cached page for anonymous visitors is shared by everyone and expires after 12–24h. A page served from cache near the end of a nonce tick can carry a stale nonce, and AJAX then fails with `-1`/403. Prefer fetching a fresh nonce via an uncached endpoint before submitting, or don't rely on nonces for anonymous non-mutating requests.
- Never print a logged-in user's nonce into a page that could be cached for anonymous visitors.
- Form success/error messages driven by query args or cookies must not end up in the cached copy.

## Purging
- Content changes made through code paths that skip the normal hooks (direct `$wpdb` updates, custom tables, options/ACF option pages, cron imports, term meta) don't trigger the purge plugin. The change won't show until the TTL ends. Check whether a purge is triggered (for nginx-helper: `do_action('rt_nginx_helper_purge_all')` or the URL purge API), or whether a TTL-old delay is acceptable.
- New public URLs (custom routes, rewrite endpoints, CPT archives) are purged when related content changes.
- Don't purge the whole cache on frequent events (every view counter, every cron tick): it removes the benefit of the cache.

## Endpoints and headers
- Requests the server doesn't cache: confirm new AJAX/REST/custom endpoints are in that set, or are designed to be cache-safe. A personalized GET endpoint on a cacheable URI leaks between users.
- Code that sets cookies on anonymous front-end GET requests (e.g. tracking, setting a "seen" flag) creates per-visitor state on a page that will still be cached.
- `Cache-Control`/`Vary` headers set by PHP may be ignored by FastCGI cache depending on server config; don't rely on them without checking.

## Client-side follow-ups
- JS that renders per-user state (login/logout header, bookmarks, counters) works when the HTML is a cached anonymous copy, i.e. it fetches state rather than trusting server-rendered markup.
- Assets: a change to enqueued files must change the version/hash (Bud's manifest does this), or cached HTML keeps pointing to old URLs. Mostly a concern with hardcoded asset URLs.
