# REST API

Read this when building custom endpoints, extending core REST routes, or integrating the Block Editor's data layer.

---

## When to use REST

- Frontend JavaScript (Block Editor, React components, Vue apps) talking to WordPress
- Headless / decoupled setups (Next.js, mobile apps)
- Server-to-server integrations
- Replacing `admin-ajax.php` in new code

For admin-side AJAX in legacy codebases, `admin-ajax.php` still works. For simple form POSTs with full page reloads, `admin-post.php` is fine. New code should use REST.

---

## Registering a custom endpoint

```php
add_action('rest_api_init', function () {
    register_rest_route('acme/v1', '/books', [
        [
            'methods'             => WP_REST_Server::READABLE,     // GET
            'callback'            => 'acme_get_books',
            'permission_callback' => '__return_true',               // Public read
            'args' => [
                'per_page' => [
                    'default'           => 10,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => fn ($v) => $v > 0 && $v <= 100,
                ],
                'search' => ['type' => 'string', 'validate_callback' => 'rest_validate_request_arg', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ],
        [
            'methods'             => WP_REST_Server::CREATABLE,    // POST
            'callback'            => 'acme_create_book',
            'permission_callback' => fn () => current_user_can('edit_posts'),
            'args' => [
                'title' => ['required' => true, 'type' => 'string', 'validate_callback' => 'rest_validate_request_arg', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ],
    ]);

    register_rest_route('acme/v1', '/books/(?P<id>\d+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'acme_get_book',
        'permission_callback' => '__return_true',
        'args' => [
            'id' => ['sanitize_callback' => 'absint', 'validate_callback' => fn ($v) => $v > 0],
        ],
    ]);
});
```

**Method constants:**
- `WP_REST_Server::READABLE` = GET
- `WP_REST_Server::CREATABLE` = POST
- `WP_REST_Server::EDITABLE` = POST + PUT + PATCH
- `WP_REST_Server::DELETABLE` = DELETE
- `WP_REST_Server::ALLMETHODS` = all

**`permission_callback` is mandatory.** Omitting it emits a doing_it_wrong warning in WP 5.5+, but does not refuse registration: the route can remain publicly accessible. Never rely on the warning as access control. `__return_true` is correct for genuinely public data — be intentional.

---

## Callback pattern

```php
function acme_get_books(WP_REST_Request $request) {
    $query = new WP_Query([
        'post_type'      => 'book',
        'posts_per_page' => $request->get_param('per_page'),
        's'              => $request->get_param('search'),
        'paged'          => max(1, (int) $request->get_param('page')),
    ]);

    $books = array_map(fn (WP_Post $post) => [
        'id'        => $post->ID,
        'title'     => get_the_title($post),
        'excerpt'   => wp_strip_all_tags(get_the_excerpt($post)),
        'permalink' => get_permalink($post),
    ], $query->posts);

    $response = rest_ensure_response($books);
    $response->header('X-WP-Total',      (int) $query->found_posts);
    $response->header('X-WP-TotalPages', (int) $query->max_num_pages);

    return $response;
}
```

**Return types from a callback:**
- Array or scalar → auto-wrapped in a 200 response
- `WP_REST_Response` → returned as-is (use `rest_ensure_response()` to always get one)
- `WP_Error` → auto-converted to an error response using `data['status']`

```php
// Error responses
return new WP_Error('not_found',    'Not found.',    ['status' => 404]);
return new WP_Error('forbidden',    'Forbidden.',    ['status' => 403]);
return new WP_Error('bad_request',  'Bad request.',  ['status' => 400]);
return new WP_Error('server_error', 'Server error.', ['status' => 500]);
```

---

## Authentication

**Cookie auth + nonce** (for logged-in users in the browser — Block Editor, admin screens):

```js
// JS using wp.apiFetch — nonce set automatically
wp.apiFetch({ path: '/acme/v1/books', method: 'POST', data: { title: 'My Book' } });

// Or vanilla fetch:
fetch('/wp-json/acme/v1/books', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce':   wpApiSettings.nonce,
    },
    body: JSON.stringify({ title: 'My Book' }),
});
```

Pass the nonce to JS:
```php
wp_localize_script('my-script', 'wpApiSettings', [
    'nonce'  => wp_create_nonce('wp_rest'),
    'root'   => esc_url_raw(rest_url()),
]);
```

**Application Passwords** (server-to-server):
Users generate an Application Password under their profile. Send as `Authorization: Basic base64(user:app-password)`.

---

## `args` for validation and sanitization

```php
'args' => [
    'email' => [
        'required'          => true,
        'type'              => 'string',
        'format'            => 'email',
        'sanitize_callback' => 'sanitize_email',
        'validate_callback' => fn ($v) => is_email($v),
    ],
    'count' => [
        'type'              => 'integer',
        'minimum'           => 1,
        'maximum'           => 100,
        'validate_callback' => 'rest_validate_request_arg',
        'sanitize_callback' => 'absint',
    ],
    'status' => [
        'type'              => 'string',
        'validate_callback' => 'rest_validate_request_arg',
        'enum'              => ['draft', 'publish', 'pending'],
        'sanitize_callback' => 'sanitize_key',
    ],
],
```

Validation runs before the endpoint callback when validation callbacks are configured. With a custom sanitize_callback, schema validation can be bypassed unless you also provide validate_callback (for example rest_validate_request_arg). Do not assume type/minimum/maximum/enum alone will reject invalid input in that case. The default rest_parse_request_arg sanitizer validates schema only when it has not been replaced.

---

## Extending core endpoints

Add a custom field to `wp/v2/posts`:

```php
add_action('rest_api_init', function () {
    register_rest_field('post', 'reading_time', [
        'get_callback' => function (array $post): int {
            $words = str_word_count(wp_strip_all_tags(get_post_field('post_content', $post['id'])));
            return (int) ceil($words / 200);
        },
        'update_callback' => null, // Read-only
        'schema' => [
            'description' => 'Estimated reading time in minutes.',
            'type'        => 'integer',
            'context'     => ['view', 'edit'],
        ],
    ]);
});
```

To modify a core endpoint's response:

```php
add_filter('rest_prepare_post', function (WP_REST_Response $response, WP_Post $post) {
    $data = $response->get_data();
    unset($data['guid']); // Remove fields you don't want
    $response->set_data($data);
    return $response;
}, 10, 2);
```

---

## Custom post types + meta in REST

A CPT must have `show_in_rest => true` or the Block Editor won't work on it:

```php
register_post_type('book', [
    'show_in_rest' => true,
    'rest_base'    => 'books',
    // ...
]);
```

Expose custom meta:

```php
register_post_meta('book', 'isbn', [
    'show_in_rest'      => true,
    'single'            => true,
    'type'              => 'string',
    'sanitize_callback' => 'sanitize_text_field',
    'auth_callback'     => fn () => current_user_can('edit_posts'),
]);
```

---

## Common REST gotchas

- **No `permission_callback`** → endpoint can be open to everyone. WP 5.5+ logs a doing_it_wrong warning but still registers the route; add an explicit permission callback.
- **Pretty permalinks required** — REST routes need rewrite rules. If REST returns 404s, visit Permalinks settings to flush.
- **CORS** — WordPress doesn't allow cross-origin REST by default. Add headers via `rest_pre_serve_request` if consuming from a different domain.
- **Block Editor breaks without REST** — CPT `show_in_rest: false`, unregistered meta, or missing `'supports' => ['custom-fields']` all silently break the editor.
- **Caching REST responses** — responses for logged-in users have anti-cache headers. For public cacheable endpoints, filter `rest_post_dispatch` to add `Cache-Control: max-age=...`.

---

## Versioning

Register `acme/v2` alongside `acme/v1` for breaking changes — never mutate an existing version. When deprecating v1, add response headers:

```php
$response->header('Deprecation', 'Sun, 01 Jan 2026 00:00:00 GMT');
$response->header('Sunset',      'Sun, 01 Jul 2026 00:00:00 GMT');
$response->header('Link',        '</wp-json/acme/v2/books>; rel="successor-version"');
```
