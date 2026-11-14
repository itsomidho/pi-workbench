# Infrastructure checklist (Docker, CI, server config, dependencies)

## Dockerfile
- Every component that needs `composer install` / a JS build is in the build loop. A new first-party plugin or theme with `composer.json` or `package.json` missing from the build lists (e.g. `COMPOSER_DIRS` / `NODE_DIRS`) ships without `vendor/` or built assets: 🔴 fatal or broken page in the image.
- Built outputs copied into the final stage match what the build produces (`public/`, `blocks/build/`). A renamed output dir silently ships nothing.
- Build-time env the bundler needs (e.g. public path for Bud) is passed as `ARG`/`ENV`; gitignored `.env` files aren't in the build context.
- Base images pinned to a specific tag (not `latest`); PHP version in the image matches the PHP floor the code assumes.
- Layer order keeps caches useful (OS packages before `COPY` of source). No secrets in `ARG`/`ENV`/layers (they persist in image history); use BuildKit secrets.
- `.dockerignore` excludes `node_modules`, `.git`, `.env`, uploads.
- Entrypoint/sync scripts: `rsync --delete` excludes runtime data (`uploads`, `upgrade`, `wp-config.php`, persisted plugins). A missing exclude deletes user data on deploy: 🔴.
- File ownership/permissions: `www-data` owns `wp-content`, nothing world-writable.

## CI (`.gitlab-ci.yml`)
- Secrets come from protected/masked CI variables; `docker login` uses `--password-stdin`, not `-p`.
- `rules:` trigger on what's intended (tags vs branches); a change in rules can stop deploys or build every branch.
- Image tags unique and traceable (git tag + short SHA); no overwriting of release tags.
- Toolchain versions (Node, Composer, PHP) match the project's `engines` / `composer.json` and local dev.

## Server and WordPress config
- `wp-config*.php`: no committed real credentials or salts; `WP_DEBUG_DISPLAY` false outside dev; `DISALLOW_FILE_EDIT` / `DISALLOW_FILE_MODS` kept if previously set; env values read via `getenv()` with safe defaults.
- Check which web server production actually runs (project file). On an Nginx-only server, `.htaccess` changes have **no effect**. Flag an MR that relies on them for redirects, headers or access rules; that config has to change on the server instead.
- Server config managed outside the repo (WordOps, control panels): mention in the summary any change that needs a matching server-side step (new rewrite rule, cache skip rule, PHP extension, upload size, cron).
- `.htaccess` / nginx: no rule that exposes `wp-config.php`, `.env`, `.git`, `vendor/`, `composer.json`, or logs; `xmlrpc.php` handling unchanged unless intended; redirects don't create loops or drop query strings unexpectedly.
- Cache/purge config (nginx-helper, CDN) still purges the URLs the change affects.

## Dependencies
- `composer.json` / `package.json` changes come with matching lock file changes (and vice versa).
- New dependency: maintained, license compatible, not duplicating something already installed; production code doesn't depend on a `require-dev` package.
- Major version bumps: check the changelog for breaking changes affecting call sites in the diff.
- Third-party WordPress plugins added/removed/bumped: note in the summary which first-party call sites depend on them (e.g. ACF Pro ↔ SCF: every `acf_*` / `get_field` call site).

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/wp-cli.md` (deploy commands)
