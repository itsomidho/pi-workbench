# Security checklist (always loaded; findings are 🔴 Critical by default)

## SQL and `$wpdb`
- Every dynamic value goes through `$wpdb->prepare()`. Flag interpolation or concatenation into SQL, and `%s`/`%d`/`%f` count or type mismatches.
- `LIKE` patterns need `$wpdb->esc_like()` before `prepare()`.
- Table and column names can't be parameterized: verify they come from a trusted allowlist (`$wpdb->prefix`, constants), never user input. Same for `ORDER BY` / `order` values: allowlist them.
- `prepare()` with no placeholders triggers a `_doing_it_wrong` notice; not a security issue, but flag it as a warning.

## Authorization, nonces, CSRF
- State-changing paths (AJAX handlers, `admin_post_*`, form posts, REST callbacks, request-triggered cron mutations) verify a nonce: `check_ajax_referer`, `check_admin_referer`, `wp_verify_nonce`.
- Privileged actions check `current_user_can()` with the right capability. Logged in is not authorized; `is_admin()` only means "admin screen", not "administrator".
- `wp_ajax_nopriv_*` handlers are reachable by anyone: they must not mutate data or expose non-public data without their own check.
- REST routes need a real `permission_callback`. Flag `'__return_true'` on anything that writes or returns non-public data.

## Input
- `$_GET`/`$_POST`/`$_REQUEST`/`$_COOKIE`/`$_SERVER` and REST params are sanitized at the boundary: `wp_unslash()` first, then `sanitize_text_field`, `sanitize_key`, `absint`, `sanitize_email`, `esc_url_raw`, etc.
- REST args should declare `sanitize_callback`/`validate_callback` or a `type` schema.
- `unserialize()` / `maybe_unserialize()` on user input → object injection. Use JSON.
- File uploads: check type with `wp_check_filetype_and_ext()`, go through `wp_handle_upload()`; never trust the client filename or MIME.
- Redirects to user-supplied URLs use `wp_safe_redirect()` (open redirect otherwise), followed by `exit`.
  - Exception (added 2026-10-13): a target built entirely in code from `admin_url()` (fixed path + fixed flags, no request input) may use `wp_redirect()` + `exit` when the admin host isn't in `allowed_redirect_hosts` (e.g. academy's separate admin domain). Don't flag that; do flag any request input reaching it.

## Output
- Escape at the point of output: `esc_html`, `esc_attr`, `esc_url`, `esc_js`, `wp_kses`/`wp_kses_post`. Use the function for the context (attribute vs URL vs HTML).
- Blade: `{{ }}` escapes, `{!! !!}` doesn't. Flag every `{!! !!}` carrying dynamic, user-derived, ACF/SCF, or remote data unless it's already passed through `wp_kses*`.
- `get_field()` / `get_option()` / post meta output is not escaped; an editor-controlled `javascript:` URL in an `href` is XSS.
- JSON into inline scripts: `wp_json_encode()` + `wp_add_inline_script()` / `wp_localize_script()`, not string concatenation.

## Shared origin
When the project file says the site shares its origin with other applications (e.g. WordPress in a sub-directory of a larger domain):
- XSS impact reaches every app on that origin (their non-HttpOnly cookies, `localStorage`, same-origin requests). Treat every XSS finding as 🔴.
- Cookies set by this site are scoped to its own path (`COOKIEPATH`, or `path=/<site>/` in JS) unless sharing is intended; a `path=/` cookie is sent to and readable by the sibling apps.
- `postMessage`, CORS and redirect allowlists don't trust the whole origin implicitly as "this site".

## Files and secrets
- No hardcoded API keys, tokens, passwords, or private endpoints (OpenAI keys, SMS gateways, Nexus credentials). They belong in env vars or `wp-config.php` constants.
- Directly reachable PHP files guard with `defined('ABSPATH') || exit;` (not needed for files only loaded via Composer autoload).
- No debug leftovers that leak data: `var_dump`, `print_r`, `error_log` of request bodies or tokens, `WP_DEBUG_DISPLAY` true in committed config, log files committed into plugin dirs.
- `include`/`require` paths never built from user input (LFI).

## Remote calls
- `wp_remote_*` sets a sensible `timeout`, checks `is_wp_error()`, and checks the response code before using the body.
- Don't disable TLS verification (`sslverify => false`) outside local dev.
- Server-side requests to user-supplied URLs use `wp_safe_remote_*` (SSRF).

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/security.md`, `rest-api.md`, `database.md`
