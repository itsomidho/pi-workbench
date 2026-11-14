# WordPress core checklist

## Hooks
- `add_action`/`add_filter` accepted-args count matches the callback's parameters; priority is deliberate where order matters.
- Filters always return a value, on every branch (a missing return blanks the content).
- Hooks fire at the right time: no `current_user_can`, `is_*` conditionals or `WP_Query` before `init`/`wp`; no enqueues outside `wp_enqueue_scripts`/`admin_enqueue_scripts`/`enqueue_block_*`.
- `remove_action`/`remove_filter` uses the same callback reference and priority as the add.
- `pre_get_posts` changes check `$query->is_main_query()` and `! is_admin()` where appropriate.

## Data APIs
- Prefer WP APIs (`WP_Query`, `get_posts`, meta/term/option APIs) over raw SQL where an equivalent exists. Direct `$wpdb` on a custom table is legitimate: judge it on prepared-statement safety (see `security.md`).
- `get_post_meta($id, $key, true)` vs `false`: single vs array; check the caller expects the right shape.
- Options: large or rarely-used options registered with `autoload => false` (`add_option(..., 'no')` / `update_option(..., false)`).
- After a custom query loop, `wp_reset_postdata()`.

## URLs and paths
- Build URLs with `home_url()`, `site_url()`, `rest_url()`, `admin_url('admin-ajax.php')`, `content_url()`, `plugins_url()`, `get_permalink()`, or the theme's asset helpers. Hardcoded root-relative URLs (`/wp-json/…`, `/wp-admin/…`, `/wp-content/…`, `href="/…"`) and hardcoded domains break when WordPress runs in a sub-directory or on another domain. Check the project file: if production runs in a sub-directory, this is 🔴, and it often passes local testing when the local site runs at the web root.
- Filesystem paths via `plugin_dir_path(__FILE__)`, `get_theme_file_path()`, `ABSPATH`, `WP_CONTENT_DIR`, never absolute server paths.

## Custom fields (ACF Pro / Secure Custom Fields)
- Field names match the field group definition (check `acf-json/` in the repo, or the PHP registration). A typo silently returns `null`.
- `get_field()` with a post ID outside the loop; options pages use `'option'`.
- Output is not escaped (see `security.md`).
- Code that must work with both ACF Pro and SCF uses only the shared API; flag Pro-only functions if the site may run SCF.

## i18n and locale
- User-facing strings wrapped in `__()`, `_e()`, `esc_html__()`, `_n()`, etc., with the component's own text domain (grep existing usage; the project file lists them).
- The source language is whatever the codebase already uses. Persian source strings inside `__()` are fine when that's the existing convention; don't ask for English source strings or a `.po`/`.mo` workflow the project doesn't have. What matters is that the string is wrapped, uses the right text domain, and follows the surrounding code.
- No variables or concatenation inside the translatable string; use `sprintf` with placeholders and a `/* translators: */` comment.
- Dates through `wp_date()` / `date_i18n()` (calendar-aware, e.g. Jalali via wp-parsidate), not raw `date()`/`DateTime::format()` for display. Store and compare in UTC / GMT.
- Numbers for display through `number_format_i18n()`.

## Caching
- Transients / object cache keys include every variable the value depends on (post ID, locale, user role, page number).
- Every cached write has an invalidation path (on `save_post`, term update, option update) or a deliberate short TTL.
- Don't cache per-user data in a shared key.

## Cron
- WP-Cron callbacks are idempotent and bounded (batching, time limit); scheduling is guarded with `wp_next_scheduled()` so it doesn't stack.
- Custom intervals registered via `cron_schedules`; events unscheduled on deactivation.
- Heavy work isn't triggered by a front-end page load.

## REST API
- Routes registered on `rest_api_init`, namespaced and versioned (`vendor/v1`).
- Responses via `rest_ensure_response()` / `WP_REST_Response` / `WP_Error` with a proper status, not `echo` + `die`.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/wp-integration.md`, `rest-api.md`, `database.md`
