# Sage and Blade checklist

## Detect the version first (per theme)
- `bud.config.js` present → **Sage 10** (Bud/webpack).
- `vite.config.js` present → **Sage 11** (Vite).
- Confirm with the theme's `composer.json` (`roots/sage`, `roots/acorn`) and `package.json` scripts (`bud build` vs `vite build`).

Only flag a mismatch between the pattern and the detected version. Never flag a Sage 10 pattern as "outdated" in a Sage 10 theme.

## Sage 10
- Assets enqueue via `bundle('<entry>')->enqueue()` (in `app/setup.php`). Vite-era syntax (`@vite`, `Vite::asset()`) won't resolve: 🔴.
- A new Bud entry must be added in `bud.config.js` (`.entry(...)`) **and** enqueued via `bundle('<entry>')`. One without the other means a missing file or dead code.
- Static assets referenced with `asset('images/...')` / `@asset`, not hardcoded `/public/` paths.
- Public path: if `bud.config.js` reads an env var (e.g. `setPublicPath(process.env.…)`), the build pipeline must supply it, or compiled font/image URLs break (see `infra.md`).

## Sage 11
- Vite (`vite.config.js`, `laravel-vite-plugin`, `@roots/vite-plugin`); assets via `Vite::asset()` / `@vite`.
- Leftover `bud.config.js`, `bundle()` calls or Bud-era `package.json` scripts are migration leftovers that break asset loading.
- Files follow Laravel conventions; flag files left in Sage 10 locations after a migration.

## Both
- Assets resolve through the manifest helpers. Flag hardcoded `/dist/`, `/public/`, `/public/build/` paths and raw `get_template_directory_uri()` asset URLs (no cache-busting, breaks with a different public path).
- Tailwind: new class names in PHP/Blade/JS files are inside the `content` globs in `tailwind.config.js`, or they get purged in production.

## Blade
- `{{ }}` escapes, `{!! !!}` doesn't (see `security.md`).
- Logic belongs in view composers / Acorn services, not templates. Flag queries (`WP_Query`, `get_posts`, `get_field` in loops), remote calls, and heavy computation inside `.blade.php`.
- `@include` / `<x-component>` names match an existing view or component class; a typo is a runtime error.
- Variables used in a view are provided by its composer (`with()`), the `@include` data, or the component's public properties. An undefined variable is a warning/error.
- Loops over WP posts set up and reset postdata (`@php(the_post())` + `wp_reset_postdata()`) or use passed data instead.
- `@php ... @endphp` blocks growing in a template are a smell; suggest moving to a composer.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/sage-theme.md`, `blade-templates.md`
