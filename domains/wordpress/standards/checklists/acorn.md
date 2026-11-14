# Acorn checklist (service providers, composers, container, config)

## Service providers
- `register()` only binds into the container. Side effects (adding hooks, querying, reading the current user) belong in `boot()`; in `register()` they run before other providers are available.
- Bindings that hold state or are expensive to build are `singleton()`, not `bind()` (a new instance per resolve).
- A new provider is registered somewhere Acorn reads it. An unregistered provider is dead code. Check where the theme registers its existing providers and confirm the new one follows the same path:
  - `extra.acorn.providers` in the theme's `composer.json` (Sage 10; needs a rebuilt package manifest, e.g. `wp acorn package:discover` / `composer dump-autoload`, on deploy);
  - `$this->app->register(...)` inside an already-registered provider;
  - `providers` in `config/app.php`, if the theme has one;
  - `Application::configure()->withProviders([...])` in `functions.php` (Acorn 5 / Sage 11).
- Deferred providers declare `provides()` correctly.

## View composers
- Composer classes live in `app/View/Composers`, extend `Roots\Acorn\View\Composer`, and declare `protected static $views = [...]` matching the actual view names. A wrong view name means the data never arrives.
- `with()` returns data, it doesn't echo. Expensive values are computed once (cache or memoize), not per view render in a loop.
- `override()` vs `with()`: `override()` replaces data passed by the caller; flag if that's not intended.

## Container and facades
- Constructor injection over `app()` / `resolve()` calls scattered in code.
- Facades used only where Acorn registers them; a Laravel facade Acorn doesn't ship (e.g. `DB`, `Queue` without the package) is a fatal.

## Config and env
- New config keys read via `config('file.key')` exist in `config/*.php` with a default.
- `env()` is called only inside `config/*.php`, not in app code (breaks with config caching).
- After config or provider changes, `wp acorn optimize:clear` / cache clear may be needed on deploy; mention it if the pipeline caches config.

## Acorn version
- Find the installed Acorn version: the theme's `composer.json`/`composer.lock`, or wherever it's loaded from if the theme doesn't require it (a plugin, mu-plugin, or root `vendor/`; `functions.php` errors with an install link when it's missing). Acorn 5 changed bootstrapping (`Application::configure()->boot()`) and some namespaces. Flag APIs that don't exist in the installed major version.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/acorn-laravel.md`, `service-providers.md`
