# WP-CLI

Use WP-CLI instead of one-off PHP scripts for operational tasks: migrations, search-replace, user management, options, cron, exports. On Roots projects, `wp acorn` extends this with Laravel scaffolding and migrations.

---

## The most important command: `search-replace`

For moving a site between domains, `search-replace` handles serialized PHP correctly — a raw SQL `UPDATE` will not:

```bash
# Always dry-run first
wp search-replace 'https://old.example.com' 'https://new.example.com' --dry-run

# Then for real
wp search-replace 'https://old.example.com' 'https://new.example.com' \
    --skip-columns=guid \
    --all-tables-with-prefix

# Multisite
wp search-replace 'old.example.com' 'new.example.com' --network --all-tables
```

`--skip-columns=guid` — GUIDs are post identifiers that must not change, even on URL migration.
`--all-tables-with-prefix` — safer than `--all-tables` if non-WP tables share the database.

---

## Common operations

```bash
# Core
wp core version
wp core update && wp core update-db
wp core verify-checksums       # Check core files against official release

# Database
wp db export backup.sql
wp db import backup.sql
wp db optimize
wp db size --tables
wp db search 'some-text'       # Find all rows containing a string

# Posts
wp post list --post_type=page --format=ids
wp post update 42 --post_status=draft
wp post delete $(wp post list --post_status=trash --format=ids) --force

# Users
wp user list --role=editor
wp user create alice alice@example.com --role=editor --send-email
wp user update alice --role=administrator
wp user delete alice --reassign=1

# Options
wp option get blogname
wp option update blogname 'New Name'
wp option update my_option 'value' --autoload=no
wp option list --search='*acme*'

# Plugins / themes
wp plugin update --all
wp plugin list
wp theme activate my-theme

# Cron
wp cron event list
wp cron event run --due-now
wp cron event run acme_daily_sync
wp cron test

# Transients / cache
wp transient delete --expired
wp cache flush
wp rewrite flush
```

---

## Migration workflow

```bash
# On production — export + transfer wp-content/
wp db export prod-backup.sql

# On staging — import + repoint URLs
wp db import prod-backup.sql
wp search-replace 'https://example.com' 'https://staging.example.com' \
    --skip-columns=guid --all-tables-with-prefix
wp cache flush
wp rewrite flush

# Disable indexing + cron on staging
wp option update blog_public 0
wp config set DISABLE_WP_CRON true --raw
```

---

## `wp eval` and `wp eval-file`

Run arbitrary PHP with WordPress loaded — useful for ad-hoc scripts:

```bash
wp eval 'echo wp_count_posts()->publish;'

wp eval-file migrate-meta.php
```

```php
// migrate-meta.php
$ids = get_posts(['post_type' => 'book', 'posts_per_page' => -1, 'fields' => 'ids']);

foreach ($ids as $id) {
    $old = get_post_meta($id, 'book_author', true);
    if ($old) {
        update_post_meta($id, '_acme_author', sanitize_text_field($old));
        delete_post_meta($id, 'book_author');
    }
}

WP_CLI::success(sprintf('Migrated %d posts.', count($ids)));
```

---

## Custom WP-CLI commands (vanilla WP)

```php
if (defined('WP_CLI') && WP_CLI) {
    /**
     * Imports books from a CSV.
     *
     * ## OPTIONS
     * <file>
     * : Path to the CSV file.
     *
     * [--dry-run]
     * : Simulate without writing.
     *
     * ## EXAMPLES
     *   wp acme import-books books.csv
     *   wp acme import-books books.csv --dry-run
     *
     * @when after_wp_load
     */
    WP_CLI::add_command('acme import-books', function (array $args, array $flags) {
        [$file] = $args;
        $dry_run = isset($flags['dry-run']);

        if (! file_exists($file)) WP_CLI::error("File not found: {$file}");

        $rows   = array_map('str_getcsv', file($file));
        $header = array_shift($rows);
        $bar    = WP_CLI\Utils\make_progress_bar('Importing', count($rows));
        $count  = 0;

        foreach ($rows as $row) {
            $data = array_combine($header, $row);
            if (! $dry_run) {
                wp_insert_post(['post_type' => 'book', 'post_title' => $data['title'], 'post_status' => 'publish']);
            }
            $count++;
            $bar->tick();
        }

        $bar->finish();
        WP_CLI::success(sprintf('%s %d books.', $dry_run ? 'Would import' : 'Imported', $count));
    });
}
```

The docblock (with `## OPTIONS`, `## EXAMPLES`) is parsed by WP-CLI for `wp help acme import-books`. Always write it.

---

## `wp acorn` commands (Roots stack)

```bash
# Scaffolding
wp acorn make:composer PageHeader
wp acorn make:provider BooksServiceProvider
wp acorn make:component Button
wp acorn make:console SyncBooks
wp acorn make:migration create_books_table
wp acorn make:livewire BookSearch    # Requires roots/acorn-livewire

# Cache
wp acorn cache:clear
wp acorn view:clear                  # Clear compiled Blade views
wp acorn config:cache               # Cache config for production

# Database
wp acorn migrate
wp acorn migrate:rollback
wp acorn migrate:status
wp acorn migrate:fresh              # Drop all + re-migrate (dev only)

# Interactive
wp acorn tinker                     # REPL with full WP + Laravel context
wp acorn list                       # All available commands
```

---

## Useful flags

- `--format=json|csv|yaml|table|ids` — output format; `--format=ids` chains well with shell pipelines
- `--dry-run` — available on many commands
- `--yes` — skip confirmations (for scripts)
- `--quiet` — suppress informational output
- `--user=<id-or-login>` — run as a specific user (capability checks use this)
- `--ssh=<user@host>` — run on a remote server via SSH
- `--debug` — show what WP-CLI is doing internally

---

## Shell pipelines

```bash
# Delete all trashed posts
wp post delete $(wp post list --post_status=trash --format=ids) --force

# Update meta on all products
wp post list --post_type=product --format=ids \
    | xargs -I {} wp post meta update {} _promoted 1

# Find the largest autoloaded options
wp db query "SELECT option_name, LENGTH(option_value) AS bytes \
    FROM wp_options WHERE autoload='yes' ORDER BY bytes DESC LIMIT 10"
```

---

## Gotchas

- **Multisite** — commands default to the main site. Use `--url=https://subsite.example.com` or `--network` for network-wide operations.
- **Memory** — long-running commands can hit PHP memory limits. Pass `-d memory_limit=512M` to the PHP CLI.
- **`wp acorn` commands won't register** if the theme/plugin that boots Acorn isn't active.
