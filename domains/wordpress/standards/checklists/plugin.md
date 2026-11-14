# Plugin checklist (first-party plugins and mu-plugins)

## Lifecycle
- `register_activation_hook` / `register_deactivation_hook` called from the main plugin file with `__FILE__`, not from a hook callback (they never fire otherwise).
- Activation creates tables via `dbDelta()` with a stored schema version; upgrades compare the stored version and migrate. A schema change without a version bump never reaches existing sites.
- Deactivation clears cron events and rewrite rules it added; it doesn't delete data. Data removal belongs in `uninstall.php` (guarded by `WP_UNINSTALL_PLUGIN`).
- `flush_rewrite_rules()` only on activation/deactivation, never on `init` (expensive on every request).

## Header and loading
- Header fields stay accurate when the change raises requirements: `Requires PHP`, `Requires at least`, `Version`. The version is also used for asset cache-busting.
- Bootstrapping waits for dependencies: code that needs ACF/SCF, Yoast or another plugin checks it's active (`function_exists`/`class_exists`) on `plugins_loaded` or later.
- mu-plugins load before regular plugins and can't be deactivated: a fatal there takes down the whole site, including wp-admin. Review them with extra care.

## Namespacing and conflicts
- Functions, classes, constants, options, transients, meta keys, CPT/taxonomy slugs, AJAX actions, REST namespaces and script handles are prefixed with the plugin's own prefix.
- CPT and taxonomy slugs ≤ 20 / 32 chars; changing an existing slug orphans data (flag as critical unless a migration is included).

## Assets
- Enqueued only where needed (check screen/hook in admin, conditionals on front end), with a version for cache-busting.
- Built assets referenced from the build output (`blocks/build/`, `assets/dist/`) that the deploy pipeline actually produces (see `infra.md`).

## Admin UI
- Settings via the Settings API (`register_setting` with a `sanitize_callback`).
- Admin notices dismissible and scoped to the relevant screens.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/plugin-development.md`
