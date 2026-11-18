---
name: wordpress-guide
description: >
  Professional WordPress development — vanilla WP and the Roots stack (Sage + Acorn).
  Trigger on: WordPress, WP, WooCommerce, Gutenberg, block themes, custom plugins,
  wp-content, wp-config, theme.json, custom post types, WP-CLI, Block Editor,
  wp-admin, wp-includes paths, PHP with WP functions (add_action, add_filter,
  wp_enqueue_, register_post_type, get_posts, WP_Query, etc.),
  roots/sage, roots/acorn, Bedrock, Radicle, resources/views/ with .blade.php files,
  functions.php calling Application::configure() or \Roots\bootloader(),
  wp acorn commands, app/Providers/ service providers, app/View/Composers/,
  vite.config.js at the theme root, or composer.json requiring roots/sage or roots/acorn.
---

# WordPress Developer

Production-grade WordPress development covering both the vanilla WP ecosystem and
the Roots stack (Sage + Acorn). The non-negotiables and core APIs are the same either
way — security, hooks, escaping, database safety. What differs is structure and tooling.

---

## Step 1 — Detect the stack

Before writing any substantial code, determine which environment you're in:

```bash
# Roots/Sage project?
ls resources/views/          # Blade templates
cat functions.php | grep -E "Application::configure|bootloader"
cat composer.json | grep -E "roots/sage|roots/acorn"
ls vite.config.js            # Sage 11 (current)
ls bud.config.js             # Sage 10 (older — different asset pipeline)

# Vanilla WP theme?
cat style.css | head -15     # Theme Name: header
ls theme.json                # Block theme
ls templates/                # Block theme HTML templates

# Plugin?
grep "Plugin Name:" *.php    # Plugin header

# WP version + PHP version
cat wp-includes/version.php | grep wp_version
php -v
```

| Signal | Stack |
|---|---|
| `resources/views/*.blade.php` + `app/Providers/` | **Roots / Sage** |
| `Application::configure()->boot()` in `functions.php` | **Roots / Acorn** |
| `theme.json` + `templates/*.html` | **Vanilla — Block theme** |
| `style.css` header, PHP templates | **Vanilla — Classic theme** |
| `Plugin Name:` header in PHP | **Plugin** (vanilla or Acorn-powered) |

---

## Step 2 — Load the right references

The reference files below are siblings of this SKILL.md. Resolve them relative to this skill directory, not the application repository.

### Universal references (both stacks)

- **`security.md`** — Sanitize / validate / escape, nonces, capabilities, SQL safety, file uploads, AJAX, REST. Includes Blade-specific escaping rules. **Read this for any code that touches user input.**
- **`database.md`** — `$wpdb`, prepared statements, custom tables with `dbDelta`, post meta, storage decision matrix, Eloquent basics (Roots).
- **`performance.md`** — `WP_Query` optimization flags, caching (transients, object cache, Laravel Cache), autoload bloat, asset loading, profiling.
- **`rest-api.md`** — Custom endpoints, `permission_callback`, validation/sanitization in `args`, extending core endpoints, authentication.
- **`wp-cli.md`** — `search-replace` for migrations, core/db/post/user/option/cron commands, `wp acorn` scaffolding, custom commands.
- **`coding-standards.md`** — WPCS rules, naming, prefixing, file layout, PHP 8 in WP, PHPCS setup.

### Vanilla WordPress references

- **`plugin-development.md`** — Plugin anatomy, lifecycle hooks, Settings API, options / transients / meta decision matrix, CPT registration, asset enqueuing, i18n.
- **`theme-development.md`** — Block themes vs classic themes, `theme.json` v3, templates, template parts, patterns, style variations, `functions.php` patterns.
- **`gutenberg-blocks.md`** — `block.json` v3, static vs dynamic blocks, `@wordpress/scripts`, InnerBlocks, InspectorControls, Interactivity API, common pitfalls.

### Roots stack references

- **`sage-theme.md`** — Directory structure, `setup.php`, `filters.php`, Vite config, `@vite` directive, Tailwind CSS, template hierarchy in Blade, deployment.
- **`blade-templates.md`** — `{{ }}` vs `{!! !!}`, layouts, partials, components, the Loop in Blade, View Composers: construction, auto-binding, `with()` vs `override()`.
- **`service-providers.md`** — Booting Acorn in themes and plugins, `register()` vs `boot()`, service container bindings, `ThemeServiceProvider`, plugin structure.
- **`acorn-laravel.md`** — Laravel Cache, Eloquent ORM, Migrations, Routing, Livewire, custom console commands, Logging.
- **`wp-integration.md`** — Hooks in providers, CPTs/taxonomies in Roots, `WP_Query` in Composers, REST routes from providers, admin pages, shortcodes with Blade.

---

## Non-negotiables — apply to every WordPress project

### 1. Prefix everything

WordPress is one global namespace. Prefix all functions, classes, hooks, options, post types, taxonomies, shortcodes, JS globals, CSS classes. Pick a 3–5 char slug: `acme_`, `Acme_`, `ACME_`. In Roots, namespacing replaces function/class prefixes but you still prefix hooks, options, and post types.

### 2. Hook in, never edit core

Use `add_action` / `add_filter`. Never touch `wp-includes/`, `wp-admin/`, or third-party plugin files. In Roots, hooks live in service providers or `app/filters.php` — not scattered through templates.

### 3. Sanitize → validate → escape (in that order)

- **Sanitize on input**: clean data as it arrives (`sanitize_text_field`, `wp_kses_post`, `absint`).
- **Validate before use**: confirm it's the right shape (is this a positive integer? does this post exist?).
- **Escape on output, late**: match the context — `esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`.
- In Blade: `{{ $var }}` is auto-escaped. `{!! $html !!}` is raw — only use for already-sanitized HTML.

### 4. Nonces for state changes

Cookie/session-authenticated forms, AJAX endpoints, REST routes, and URLs that modify state need CSRF nonce protection. Header-based bearer/application-password authentication follows its own verified strategy; do not require a browser cookie nonce indiscriminately. Generate with `wp_nonce_field` / `wp_create_nonce`, verify with `check_admin_referer` / `wp_verify_nonce` / `check_ajax_referer`. Nonces are CSRF protection, not authentication — always pair with a capability check.

### 5. Check capabilities

`current_user_can('edit_posts')`, not role checks. For objects: `current_user_can('edit_post', $id)`. In Roots: Acorn's Laravel auth is not WP auth — always use WordPress capability functions.

### 6. Use the WordPress APIs

HTTP → `wp_remote_get`. Email → `wp_mail`. Files → `WP_Filesystem`. Dates → `current_time()`. Paths → `plugin_dir_path(__FILE__)`, `get_theme_file_uri()`. Never raw `curl`, raw `mail()`, or hardcoded paths. In Roots, prefer `wp_remote_*` over Laravel's HTTP client unless you need its specific features.

### 7. Enqueue, never echo scripts/styles

`wp_enqueue_script` / `wp_enqueue_style`. In Roots, Vite handles main theme assets via `@vite`; use `wp_enqueue_*` for everything else (conditional scripts, admin assets, plugin assets).

### 8. Internationalize all user-facing strings

`__('Text', 'text-domain')`, `_e()`, `esc_html__()`, `_n()`, `_x()`. In Blade: `{{ __('Text', 'sage') }}`. Translator comments above strings with placeholders.

### 9. No silent failures

`WP_Error` for error states. Never suppress with `@`. Log to `error_log()` (or `Log::` in Acorn) gated on `WP_DEBUG_LOG`. Check return values from `$wpdb` writes, `wp_insert_post`, and `wp_remote_*`.

### 10. No autoload bloat

Any option over ~50 KB should have `autoload = false`. Pass `false` as the third argument: `update_option('key', $data, false)`. In Roots, use Laravel Cache for large cached values instead of autoloaded options.

---

## When to push back

These patterns come up constantly and are almost always wrong:

| Request | Right answer |
|---|---|
| "Edit a file in wp-includes/" | Find the filter or pluggable function |
| "Disable nonce verification, it keeps failing" | Fix the root cause (usually page cache) |
| "Run a raw query with mysqli" | Use `$wpdb->prepare()` or Eloquent |
| "Build a custom user table" | Use `wp_users` + user meta |
| "Suppress this error with @" | Handle it properly |
| "Load jQuery from a CDN by echoing `<script>`" | Deregister and re-register via `wp_register_script` |
| "Call `flush_rewrite_rules()` on every page load" | Only on activation |
| "Run a one-off migration in the template file" | WP-CLI command or `plugins_loaded` with version gate |

State the concern briefly, then write the correct approach.
