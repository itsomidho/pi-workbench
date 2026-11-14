# Database

Read this when working with `$wpdb`, custom tables, post meta, or any data architecture decision.

---

## Storage decision matrix

| Storage | Best for | Avoid for |
|---|---|---|
| `wp_options` (autoload=true) | Small config read every request | Anything over ~50 KB |
| `wp_options` (autoload=false) | Larger config, rarely read globally | Per-post/user data |
| Transients / Laravel Cache | Cached values with TTL | Persistent state (can be evicted) |
| Post meta | Data tied to a specific post | Querying across many posts |
| User meta | Data tied to a specific user | Complex cross-user queries |
| Term meta | Data tied to a taxonomy term | Same |
| Custom taxonomy | Shared categorical values across many posts | Unique-per-post data |
| Custom table | Large datasets, frequent writes, complex queries | Small amounts of data |

**Decision tree:**

```
Is the data tied to a single post / user / term?
├── Yes → How much? How queryable?
│   ├── A few small fields, not queried across records → meta
│   └── Queried, large, or frequently written → custom table keyed to the ID
└── No → Site-wide?
    ├── Small config, needed on every page → options (autoload=true)
    ├── Large config, not needed on every page → options (autoload=false)
    ├── Temporary cached value → transient / Cache::remember()
    └── Growing dataset (logs, events, line items) → custom table
```

---

## Autoload trap

On every request WordPress runs: `SELECT option_name, option_value FROM wp_options WHERE autoload = 'yes'` and holds the result in memory. A large autoloaded option costs that memory on **every page load**.

```php
// Default autoload = 'yes' — be intentional
update_option( 'acme_settings', $config, false );     // false = don't autoload
add_option(    'acme_big_data', $data,   '', false );  // 4th arg = autoload

// Fix existing bloat:
// UPDATE wp_options SET autoload = 'no' WHERE option_name = 'bloated_key';
// Or: wp option set bloated_key "$value" --autoload=no
```

Diagnose on any WordPress site:
```sql
SELECT option_name, LENGTH(option_value) AS bytes
FROM wp_options WHERE autoload = 'yes'
ORDER BY bytes DESC LIMIT 20;
```

Anything over 50 KB is a candidate for `autoload=false`. Anything over 1 MB is a fire.

---

## `$wpdb` essentials

```php
global $wpdb;

// Table names — always use $wpdb properties or prefix
$wpdb->posts      // wp_posts
$wpdb->postmeta   // wp_postmeta
$wpdb->users
$wpdb->usermeta
$wpdb->options
$wpdb->prefix     // "wp_"  (the actual prefix)

// Custom table
$table = $wpdb->prefix . 'acme_logs';
```

### Prepared statements — mandatory for variable input

```php
// Single value
$count = (int) $wpdb->get_var(
    $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}acme_logs WHERE user_id = %d", $user_id )
);

// Single row
$row = $wpdb->get_row(
    $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}acme_logs WHERE id = %d", $id )
);

// Multiple rows
$results = $wpdb->get_results(
    $wpdb->prepare( "SELECT * FROM {$wpdb->posts} WHERE post_type = %s LIMIT %d", 'book', 100 )
);
```

Placeholders: `%d` integer · `%f` float · `%s` string (auto-quoted, no manual quotes) · `%i` identifier (WP 6.2+).

```php
// IN () clause
$ids = [1, 2, 3];
$ph  = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
$wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->posts} WHERE ID IN ($ph)", $ids ) );

// LIKE clause
$like = '%' . $wpdb->esc_like( $search ) . '%';
$wpdb->prepare( "WHERE post_title LIKE %s", $like );
```

### Write methods

```php
// INSERT
$wpdb->insert( $wpdb->prefix . 'acme_logs',
    ['user_id' => $user_id, 'event' => $event, 'created' => current_time('mysql', true)],
    ['%d', '%s', '%s']
);
$new_id = $wpdb->insert_id;

// UPDATE
$wpdb->update( $wpdb->prefix . 'acme_logs',
    ['event' => $new_event],       // data
    ['id'    => $log_id],           // where
    ['%s'],                         // data formats
    ['%d']                          // where formats
);

// DELETE
$wpdb->delete( $wpdb->prefix . 'acme_logs', ['id' => $log_id], ['%d'] );
```

All return row count or `false` on error. Check `$wpdb->last_error` to inspect failures.

---

## Post meta

```php
update_post_meta( $post_id, '_acme_isbn', '978-0000000000' ); // creates if not exists
$isbn = get_post_meta( $post_id, '_acme_isbn', true );         // true = single value
delete_post_meta( $post_id, '_acme_isbn' );
```

Keys starting with `_` are hidden from the Custom Fields meta box (internal use). Expose in REST:

```php
register_post_meta( 'book', 'isbn', [
    'show_in_rest'      => true,
    'single'            => true,
    'type'              => 'string',
    'sanitize_callback' => 'sanitize_text_field',
    'auth_callback'     => static fn () => current_user_can( 'edit_posts' ),
] );
```

**When not to use post meta:** if you're filtering, sorting, or joining meta across thousands of posts — this will scan an unindexed TEXT column and won't scale. Use a custom table with indexed columns, or a taxonomy for categorical values.

---

## Custom tables with `dbDelta`

```php
function acme_create_tables(): void {
    global $wpdb;
    $charset = $wpdb->get_charset_collate(); // Always use this — handles utf8mb4

    $sql = "CREATE TABLE {$wpdb->prefix}acme_logs (
        id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id    BIGINT UNSIGNED NOT NULL DEFAULT 0,
        event      VARCHAR(50)     NOT NULL DEFAULT '',
        context    TEXT            NULL,
        ip_address VARCHAR(45)     NOT NULL DEFAULT '',
        created    DATETIME        NOT NULL DEFAULT '0000-00-00 00:00:00',
        PRIMARY KEY  (id),
        KEY user_id  (user_id),
        KEY event    (event),
        KEY created  (created)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );

    update_option( 'acme_db_version', '1.0.0', false );
}
```

**`dbDelta` formatting rules** (fussy, will silently fail if wrong):
- Each column definition on its own line
- Two spaces between `PRIMARY KEY` and `(id)` — yes, really
- No backtick-quoting of names inside the schema
- Use `KEY` not `INDEX`
- Put `$charset_collate` after the closing `)` with no semicolon inside

`dbDelta` can add columns and indexes but will **not** drop them. For destructive schema changes, use `ALTER TABLE` directly.

**Schema migration pattern:**
```php
add_action( 'plugins_loaded', function () {
    if ( get_option( 'acme_db_version' ) !== ACME_VERSION ) {
        acme_create_tables(); // dbDelta is idempotent — safe to re-run
        // Add any ALTER TABLE statements for new columns

        update_option( 'acme_db_version', ACME_VERSION, false );
    }
} );
```

In Roots projects, prefer **Acorn Migrations** over `dbDelta` for new custom tables — cleaner syntax, built-in migration state tracking. See `acorn-laravel.md`.

---

## Indexes — the most important thing

Every column you `WHERE`, `ORDER BY`, or `JOIN` on needs an index. A missing index on a large table means a full table scan.

```sql
-- Single column
KEY user_id (user_id)

-- Composite (covers WHERE user_id = ? AND event = ?)
KEY user_event (user_id, event)

-- Unique
UNIQUE KEY hash (hash)
```

Composite indexes work left-to-right. `(a, b, c)` serves queries filtering on `a`, `(a, b)`, or `(a, b, c)` — but not `b` alone.

---

## Transactions

```php
global $wpdb;
$wpdb->query( 'START TRANSACTION' );

try {
    $wpdb->insert( /* ... */ );
    $wpdb->update( /* ... */ );
    $wpdb->query( 'COMMIT' );
} catch ( \Throwable $e ) {
    $wpdb->query( 'ROLLBACK' );
    throw $e;
}
```

Use when multiple writes must succeed or fail together. Requires InnoDB (the default since MySQL 5.5+).

---

## Multisite

In multisite, `$wpdb->prefix` is per-site (e.g. `wp_2_`). For per-site tables this is correct. For network-wide tables, use `$wpdb->base_prefix` and add the table to `$wpdb->global_tables`:

```php
$wpdb->global_tables[] = 'acme_network_log';
$table = $wpdb->base_prefix . 'acme_network_log';
```
