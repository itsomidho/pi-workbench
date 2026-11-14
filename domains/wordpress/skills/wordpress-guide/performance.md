# Performance

Read this when working on query-heavy code, slow pages, or any feature that touches large post sets, custom queries, or frequent writes.

---

## The three highest-impact fixes

1. **Autoload bloat** — every page load fetches all autoloaded options. A large autoloaded option is a tax on every request. (See `database.md` for details and the diagnostic SQL.)
2. **Unbounded queries** — `posts_per_page => -1` on a site with 50,000 posts is a time bomb. Always bound; paginate for large sets.
3. **Uncached external HTTP** — every page load calling an external API. Cache results via transients or Laravel Cache.

---

## `WP_Query` optimization

### Bound every query

```php
// Bad — no limit
$all = get_posts(['post_type' => 'book', 'posts_per_page' => -1]);

// Better — bounded
$books = get_posts(['post_type' => 'book', 'posts_per_page' => 100, 'no_found_rows' => true]);

// Best for large sets — paginate
for ($page = 1; ; $page++) {
    $batch = get_posts(['post_type' => 'book', 'posts_per_page' => 100,
                        'paged' => $page, 'no_found_rows' => true, 'fields' => 'ids']);
    if (empty($batch)) break;
    foreach ($batch as $id) { /* process */ }
}
```

### Tell WP_Query what it doesn't need

```php
$ids = get_posts([
    'post_type'              => 'book',
    'posts_per_page'         => 500,
    'fields'                 => 'ids',          // Just IDs — massive speedup
    'no_found_rows'          => true,           // Skip SQL_CALC_FOUND_ROWS
    'update_post_meta_cache' => false,          // Skip meta prefetch
    'update_post_term_cache' => false,          // Skip term prefetch
]);
```

Use each flag when its corresponding data won't be read in the same request.

### Avoid `meta_query` on large datasets

`meta_query` joins `wp_postmeta` and filters on an unindexed TEXT column. It doesn't scale past a few thousand posts.

```php
// Slow on 50,000 posts
get_posts(['meta_query' => [['key' => 'genre', 'value' => 'fiction']]]);

// Fast — use a taxonomy
get_posts(['tax_query' => [['taxonomy' => 'genre', 'field' => 'slug', 'terms' => 'fiction']]]);
```

If you must query post meta at scale, store the queryable value as a taxonomy term or in a custom table with a proper index.

### `pre_get_posts` for the main query

```php
add_action('pre_get_posts', function (WP_Query $query) {
    if (is_admin() || ! $query->is_main_query()) return;

    if ($query->is_post_type_archive('book')) {
        $query->set('posts_per_page', 24);
        $query->set('orderby', 'title');
        $query->set('order', 'ASC');
    }
});
```

Always guard with `is_admin()` and `is_main_query()` — otherwise you modify every query on the site.

---

## Caching

### Transients (vanilla WP)

```php
function acme_get_remote_data(): array {
    $cached = get_transient('acme_remote_data');
    if (false !== $cached) return $cached;

    $response = wp_remote_get('https://api.example.com/data', ['timeout' => 10]);

    if (is_wp_error($response) || 200 !== wp_remote_retrieve_response_code($response)) {
        set_transient('acme_remote_data', [], 5 * MINUTE_IN_SECONDS); // Cache failure briefly
        return [];
    }

    $data = json_decode(wp_remote_retrieve_body($response), true) ?: [];
    set_transient('acme_remote_data', $data, HOUR_IN_SECONDS);
    return $data;
}
```

Time constants: `MINUTE_IN_SECONDS`, `HOUR_IN_SECONDS`, `DAY_IN_SECONDS`, `WEEK_IN_SECONDS`.

Expired transients accumulate in `wp_options`. Run `wp transient delete --expired` periodically.

### Laravel Cache (Roots / Acorn)

```php
use Illuminate\Support\Facades\Cache;

$data = Cache::remember('acme_remote_data', HOUR_IN_SECONDS, function () {
    $response = wp_remote_get('https://api.example.com/data', ['timeout' => 10]);
    if (is_wp_error($response)) return [];
    return json_decode(wp_remote_retrieve_body($response), true) ?: [];
});
```

### Object cache

Per-request by default; persistent across requests if Redis/Memcached is installed:

```php
$value = wp_cache_get('my_key', 'my_group');
if (false === $value) {
    $value = expensive_operation();
    wp_cache_set('my_key', $value, 'my_group', HOUR_IN_SECONDS);
}

// Invalidate
wp_cache_delete('my_key', 'my_group');
// Or whole group (with persistent object cache):
wp_cache_flush_group('my_group');
```

### Cache invalidation

```php
// Event-based — clear on save
add_action('save_post_book', function ($id) {
    delete_transient('acme_featured_books');
    wp_cache_delete($id, 'acme_book_data');
});

// Versioned key — old keys become orphans on increment
function acme_books_cache_key(): string {
    return 'acme_books_v' . (int) get_option('acme_books_cache_ver', 1);
}
add_action('save_post_book', function () {
    update_option('acme_books_cache_ver', (int) get_option('acme_books_cache_ver', 1) + 1, false);
});
```

---

## Asset loading

### Don't load on every page

```php
add_action('wp_enqueue_scripts', function () {
    if (! is_singular('book')) return;
    wp_enqueue_script('acme-gallery', /* ... */);
});
```

### `has_block` for block assets

```php
add_action('wp_enqueue_scripts', function () {
    if (has_block('acme/feature-card')) {
        wp_enqueue_script('acme-feature-card-fe', /* ... */);
    }
});
```

For blocks registered via `block.json` with `viewScript`, WordPress handles this automatically.

### Load strategy

```php
wp_enqueue_script('acme', $url, [], $version, [
    'strategy'  => 'defer',   // or 'async'
    'in_footer' => true,
]);
```

`defer` is almost always correct for non-critical scripts — downloads in parallel with HTML parsing, executes after parse.

---

## Background processing / cron

WordPress pseudo-cron fires on page load. For reliability on low-traffic sites, disable it and use real cron:

```php
// wp-config.php
define('DISABLE_WP_CRON', true);
// System cron: */5 * * * * wp --path=/path/to/wp cron event run --due-now
```

For long-running tasks, batch them:

```php
function acme_process_batch(int $offset = 0): void {
    $ids = get_posts(['post_type' => 'book', 'posts_per_page' => 100,
                      'offset' => $offset, 'fields' => 'ids', 'no_found_rows' => true]);

    foreach ($ids as $id) { acme_process_one($id); }

    if (count($ids) === 100) {
        wp_schedule_single_event(time() + 30, 'acme_process_batch', [$offset + 100]);
    }
}
add_action('acme_process_batch', 'acme_process_batch');
```

For production batch processing, use **Action Scheduler** (bundled with WooCommerce; available standalone).

---

## Profiling

- **Query Monitor plugin** — canonical dev tool. Shows every query, hook, HTTP request, script, and transient with timing. Never develop without it.
- `define('SAVEQUERIES', true)` in `wp-config.php` → inspect `$wpdb->queries`.
- `wp acorn tinker` (Roots) — interactive REPL with WP + Laravel available for ad-hoc testing.
- **New Relic / Blackfire** — APM for production profiling.

---

## Performance checklist

- [ ] No `posts_per_page => -1` on large datasets
- [ ] `no_found_rows` set where pagination total isn't needed
- [ ] `fields => 'ids'` when only IDs are needed
- [ ] `meta_query` avoided for queryable categorical data (use taxonomy)
- [ ] External HTTP results cached (transient or Cache::remember)
- [ ] No options autoloaded that don't need to be (`update_option('key', $val, false)`)
- [ ] Assets enqueued conditionally, not on every page
- [ ] `strategy => 'defer'` for non-critical scripts
- [ ] Long tasks batched via cron, not single-request
- [ ] `pre_get_posts` guarded with `is_admin()` and `is_main_query()`
