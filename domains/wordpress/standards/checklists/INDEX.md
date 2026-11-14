# Review checklists: index and routing

Shared by the `merge-request-review` skill and all WordPress agents; see `../README.md` for how each role uses them. The checklists are written as review rules ("flag X"). When writing code, read every "flag X" as "don't introduce X". Change a rule here, never in a skill or agent.

## Routing

Load `security.md` always. Then load every row whose pattern matches at least one changed first-party file. Don't load checklists for domains the change doesn't touch.

| Changed files match | Load |
|---|---|
| *(always)* | `security.md` |
| `*.php` (including `*.blade.php`) | `php.md`, `wordpress-core.md` |
| `wp-content/plugins/<first-party>/**`, `mu-plugins/**` | `plugin.md` |
| `wp-content/themes/<first-party>/**` | `theme.md` |
| `bud.config.js`, `vite.config.js`, `*.blade.php`, theme `app/setup.php`, theme `package.json` | `sage.md` |
| `app/Providers/**`, `app/View/Composers/**`, `config/*.php` in a Sage theme, `Application::configure` in `functions.php` | `acorn.md` |
| `block.json`, `blocks/src/**`, `register_block_type`, `@wordpress/*` imports | `gutenberg-blocks.md` |
| `*.js`, `*.jsx`, `*.ts`, `*.tsx`, `*.vue` (not build output) | `javascript.md` |
| `*.scss`, `*.css`, `tailwind.config.js`, `theme.json` | `css-scss.md` |
| `Dockerfile`, `.dockerignore`, `.gitlab-ci*.yml`, `docker-compose*`, nginx/Apache config, `.htaccess`, `wp-config*.php`, `composer.json`/`package.json` dependency changes | `infra.md` |
| Any PHP or Blade that queries data, calls remote services, or runs on every request; any front-end asset change | `performance.md` |
| The project file says the site is behind a full-page cache, **and** the change touches front-end output, forms, nonces, AJAX/REST, cookies, redirects, or code that changes content outside normal post saves | `page-cache.md` |

Each checklist ends with a **Deeper reference** line pointing to `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/*.md`. Open those only when a finding needs the correct API or pattern spelled out.

## Severity

- **🔴 Critical**: security holes, injection, missing auth, data loss, fatal errors on the supported PHP floor, broken deploy/build.
- **🟡 Warning**: correctness bugs, performance problems, escaping gaps on low-risk data, i18n/RTL breakage users will see.
- **🔵 Suggestion**: readability, structure, idiom. Only when it matches an established convention in the surrounding code.

## Rules for every finding

- Precision over volume. Report a finding only when you can state the concrete failure: the input or state that produces the wrong result.
- Confirm every finding by reading the actual code at that line, plus the callers or templates it affects.
- Judge against the detected stack and version (Sage 10 vs 11, PHP floor), never against assumptions.
- Don't repeat a point already raised in existing review discussions.
