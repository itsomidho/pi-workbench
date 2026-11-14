# Security

Read this whenever code touches user input, `$_GET` / `$_POST` / `$_REQUEST` / `$_COOKIE`,
AJAX, REST endpoints, forms, file uploads, database writes, shortcode attributes,
or any echoed dynamic value.

---

## Sanitization functions

Apply when data arrives. Pick the strictest function that still preserves what you need.

| Function | Use for |
|---|---|
| `sanitize_text_field()` | Single-line plain text — strips tags, extra whitespace |
| `sanitize_textarea_field()` | Multi-line plain text — strips tags, keeps line breaks |
| `sanitize_email()` | Email addresses — returns `''` if invalid |
| `sanitize_key()` | Slugs, option keys — lowercase, alphanumeric, dashes, underscores |
| `sanitize_title()` | URL slugs |
| `sanitize_file_name()` | Filenames |
| `sanitize_hex_color()` | `#rrggbb` hex colors |
| `absint()` | Positive integers (IDs) — use for any ID field |
| `intval()` / `(int)` | Integers, including negative |
| `wp_kses_post()` | HTML matching post-content allowlist |
| `wp_kses($html, $allowed)` | HTML with your own allowlist |
| `esc_url_raw()` | URLs **for storage** (not display) |

**Always `wp_unslash()` before sanitizing `$_POST` / `$_GET`** — WordPress magic-quotes superglobals and you'll save escaped data if you don't unslash first:

```php
$title = sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) );
```

---

## Escaping functions — match to context

Escape **at the point of output**, as late as possible, with the function matching where
the value appears. Never pre-escape and store — you'll need to undo it later.

| Function | Context |
|---|---|
| `esc_html()` | HTML element content: `<p><?php echo esc_html( $name ); ?></p>` |
| `esc_attr()` | HTML attribute value: `<input value="<?php echo esc_attr( $val ); ?>">` |
| `esc_url()` | `href`, `src`, `action` attributes |
| `esc_textarea()` | Inside a `<textarea>` |
| `esc_js()` | Inside an inline JS string (prefer `wp_json_encode` + `wp_add_inline_script`) |
| `wp_kses_post()` | HTML you want to render (post content, rich descriptions) |
| `absint()` | Numeric output — escaped by type coercion |

Translation-aware variants: `esc_html__()`, `esc_html_e()`, `esc_attr__()`, `esc_attr_e()`.

---

## Blade escaping (Roots / Sage)

`{{ $var }}` runs `htmlspecialchars()` — equivalent to `echo esc_html( $var )`. **Safe for all user-supplied data.** No additional escaping needed.

`{!! $html !!}` is **raw output** — only use for HTML you have already sanitized:

```blade
{{-- Safe: trusted WP output --}}
{!! get_language_attributes() !!}
{!! post_class() !!}

{{-- Safe: explicitly sanitized --}}
{!! wp_kses_post( $description ) !!}

{{-- Safe: WP's full content filter chain --}}
{!! apply_filters('the_content', get_the_content()) !!}

{{-- UNSAFE: never do this --}}
{!! $user_input !!}
{!! get_post_meta( $id, '_anything', true ) !!}
```

---

## Nonces

Nonces protect against CSRF. They confirm the request came from your form/UI, not
from a third-party site tricking a logged-in user.

**Forms (PHP):**
```php
// In the form:
wp_nonce_field( 'acme_save_settings', 'acme_nonce' );

// In the handler:
if ( ! wp_verify_nonce( wp_unslash( $_POST['acme_nonce'] ?? '' ), 'acme_save_settings' ) ) {
    wp_die( esc_html__( 'Security check failed.', 'acme' ) );
}
```

**Forms (Blade):**
```blade
<form method="POST" action="{{ esc_url( admin_url('admin-post.php') ) }}">
    @php(wp_nonce_field('acme_save', 'acme_nonce'))
    <input type="hidden" name="action" value="acme_save">
    ...
</form>
```

**AJAX:**
```php
// Localize to JS:
wp_localize_script( 'acme-js', 'acmeData', [
    'nonce'   => wp_create_nonce( 'acme_ajax' ),
    'ajaxUrl' => admin_url( 'admin-ajax.php' ),
] );

// In Blade layout:
<script>window.acmeData = {!! wp_json_encode(['nonce' => wp_create_nonce('acme_ajax')]) !!};</script>

// In handler:
check_ajax_referer( 'acme_ajax', 'nonce' );
```

**URL nonces:**
```php
$url = wp_nonce_url(
    admin_url( 'admin-post.php?action=acme_delete&id=' . $id ),
    'acme_delete_' . $id
);
check_admin_referer( 'acme_delete_' . $id );
```

**REST:** When using `wp.apiFetch` or `@wordpress/api-fetch`, the `X-WP-Nonce` header is set automatically. For custom clients, localize `wp_create_nonce('wp_rest')` and send it as the `X-WP-Nonce` header.

**Common nonce mistakes:**
- Treating nonces as authentication — they're CSRF protection. Always pair with `current_user_can()`.
- Caching forms that contain nonces — nonces are user- and time-specific. If a page cache serves stale HTML with an old nonce, verification fails. Either bypass the cache or fetch the nonce via AJAX after load.

---

## Capability checks

```php
// General capability
if ( ! current_user_can( 'manage_options' ) ) {
    wp_die( esc_html__( 'Not allowed.', 'acme' ), 403 );
}

// Object-level
if ( ! current_user_can( 'edit_post', $post_id ) ) {
    return new WP_Error( 'forbidden', 'Cannot edit this post.', [ 'status' => 403 ] );
}

// In a REST permission_callback (mandatory — never omit)
'permission_callback' => static fn () => current_user_can( 'edit_posts' ),

// In Livewire / Acorn
public function mount(): void {
    abort_unless( current_user_can( 'edit_posts' ), 403 );
}
```

---

## SQL safety — `$wpdb`

**Always** use `$wpdb->prepare()` for queries with variable input. Never interpolate.

```php
global $wpdb;

// Correct
$results = $wpdb->get_results(
    $wpdb->prepare(
        "SELECT * FROM {$wpdb->prefix}acme_logs WHERE user_id = %d AND event = %s",
        $user_id,
        $event
    )
);

// IN () clause
$ids   = [ 1, 2, 3 ];
$ph    = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
$query = $wpdb->prepare( "SELECT * FROM {$wpdb->posts} WHERE ID IN ($ph)", $ids );

// LIKE
$like  = '%' . $wpdb->esc_like( $search ) . '%';
$query = $wpdb->prepare( "SELECT * FROM {$wpdb->posts} WHERE post_title LIKE %s", $like );
```

Placeholders: `%d` integer · `%f` float · `%s` string (auto-quoted) · `%i` identifier (WP 6.2+).

For Eloquent (Roots): parameterized through `where()`. Never use `whereRaw` with string interpolation:

```php
// Wrong
BookLog::whereRaw("user_id = {$user_id}")->get();
// Right
BookLog::where('user_id', $user_id)->get();
```

---

## AJAX handler pattern

```php
add_action( 'wp_ajax_acme_save',        'acme_ajax_save' );  // Logged-in
add_action( 'wp_ajax_nopriv_acme_save', 'acme_ajax_save' );  // Logged-out (only if needed)

function acme_ajax_save(): void {
    check_ajax_referer( 'acme_ajax', 'nonce' );                      // 1. CSRF

    if ( ! current_user_can( 'edit_posts' ) ) {                      // 2. AuthZ
        wp_send_json_error( [ 'message' => 'forbidden' ], 403 );
    }

    $title = sanitize_text_field( wp_unslash( $_POST['title'] ?? '' ) ); // 3. Sanitize
    $id    = absint( $_POST['id'] ?? 0 );

    if ( ! $title || ! $id || ! get_post( $id ) ) {                  // 4. Validate
        wp_send_json_error( [ 'message' => 'invalid' ], 400 );
    }

    update_post_meta( $id, '_acme_title', $title );                  // 5. Work
    wp_send_json_success( [ 'title' => $title ] );                   // 6. Respond
}
```

---

## REST endpoint pattern

```php
add_action( 'rest_api_init', function () {
    register_rest_route( 'acme/v1', '/items/(?P<id>\d+)', [
        'methods'             => WP_REST_Server::EDITABLE,
        'callback'            => 'acme_rest_update_item',
        'permission_callback' => static fn ( $req ) => current_user_can( 'edit_post', $req['id'] ),
        'args' => [
            'id'    => [ 'sanitize_callback' => 'absint' ],
            'title' => [ 'required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
        ],
    ] );
} );

function acme_rest_update_item( WP_REST_Request $request ) {
    $result = update_post_meta( $request['id'], '_acme_title', $request['title'] );
    if ( false === $result ) {
        return new WP_Error( 'save_failed', 'Could not save.', [ 'status' => 500 ] );
    }
    return rest_ensure_response( [ 'id' => $request['id'], 'title' => $request['title'] ] );
}
```

`permission_callback` is **mandatory** — without it the endpoint is open to anyone.

---

## Dangerous functions — avoid or use with extreme care

`eval()` · `exec` / `shell_exec` / `system` / backticks · `unserialize()` on untrusted input · `extract()` · `include` / `require` with user-supplied paths · `file_get_contents` on URLs (use `wp_remote_get`) · `mail()` (use `wp_mail`).

---

## Audit checklist

- [ ] Every `$_POST`/`$_GET`/`$_REQUEST` value is `wp_unslash()` then sanitized
- [ ] Every echo of dynamic data is escaped with the right function for the context
- [ ] In Blade: all `{!! !!}` is pre-sanitized; `{{ }}` used for plain text and attributes
- [ ] Every form has a nonce; handler verifies it
- [ ] Every AJAX / REST handler checks nonce AND capability
- [ ] Every `$wpdb` query uses `prepare()` or is a static string
- [ ] No `eval`, no `unserialize` on untrusted data, no interpolated SQL
- [ ] File uploads go through `wp_handle_upload` with MIME allowlist
- [ ] External HTTP uses `wp_remote_*`
- [ ] No debug output (`var_dump`, `print_r`, `error_log` of sensitive data) in production code
