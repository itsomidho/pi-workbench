# WordPress Integration in the Roots Stack

Read this when wiring WordPress APIs — hooks, CPTs, `WP_Query`, REST routes, menus, admin pages, shortcodes — into a Sage theme or Acorn plugin.

---

## Where code lives

| Task | Location |
|---|---|
| Theme supports, nav menus, image sizes | `app/setup.php` |
| Output filters (`body_class`, `the_content`) | `app/filters.php` |
| Service bindings, third-party packages | `ServiceProvider::register()` |
| WordPress hooks, CPTs, REST routes, cron | `ServiceProvider::boot()` |
| Data for Blade templates | `app/View/Composers/` |
| Reusable UI elements | `resources/views/components/` |
| Business logic | `src/Services/` or `app/Services/` |

---

## Hooks in service providers

```php
// In ServiceProvider::boot()
public function boot(): void
{
    parent::boot(); // Required in ThemeServiceProvider

    $controller = $this->app->make(BookController::class);

    add_action('init',               [$controller, 'registerPostType']);
    add_action('rest_api_init',      [$controller, 'registerRestRoutes']);
    add_action('pre_get_posts',      [$controller, 'modifyArchiveQuery']);
    add_filter('the_content',        [$controller, 'appendReadingTime']);
}
```

Keep `boot()` as a list of hook registrations. The logic belongs in the injected class.

---

## Custom post types

```php
namespace Acme\Books\PostTypes;

class BookPostType
{
    public function register(): void
    {
        add_action('init', [$this, 'registerPostType']);
        add_action('init', [$this, 'registerGenreTaxonomy']);
    }

    public function registerPostType(): void
    {
        register_post_type('acme_book', [
            'labels'       => ['name' => __('Books', 'acme'), 'singular_name' => __('Book', 'acme')],
            'public'       => true,
            'show_in_rest' => true,         // Required for Block Editor
            'rest_base'    => 'books',
            'menu_icon'    => 'dashicons-book',
            'supports'     => ['title', 'editor', 'thumbnail', 'excerpt', 'custom-fields'],
            'has_archive'  => true,
            'rewrite'      => ['slug' => 'books'],
        ]);
    }

    public function registerGenreTaxonomy(): void
    {
        register_taxonomy('genre', 'acme_book', [
            'labels'       => ['name' => __('Genres', 'acme')],
            'public'       => true,
            'show_in_rest' => true,
            'hierarchical' => true,
        ]);
    }
}
```

Registered in `ServiceProvider::boot()`:
```php
$this->app->make(BookPostType::class)->register();
```

---

## `WP_Query` in Composers

Composers are the right place for queries that feed Blade views. For expensive repeated queries, cache in the service layer:

```php
// app/View/Composers/BookArchive.php
namespace App\View\Composers;

use Roots\Acorn\View\Composer;

class BookArchive extends Composer
{
    protected static $views = ['archive-acme_book'];

    public function with(): array
    {
        return [
            'featured' => app(\App\Services\BookRepository::class)->featured(3),
            'total'    => (int) wp_count_posts('acme_book')->publish,
        ];
    }
}
```

```php
// app/Services/BookRepository.php
use Illuminate\Support\Facades\Cache;

public function featured(int $limit = 3): array
{
    return Cache::remember("featured_books_{$limit}", HOUR_IN_SECONDS, fn () =>
        get_posts([
            'post_type'      => 'acme_book',
            'posts_per_page' => $limit,
            'meta_key'       => '_featured',
            'meta_value'     => '1',
            'no_found_rows'  => true,
        ])
    );
}
```

---

## The Loop in Blade

```blade
{{-- Main loop --}}
@while(have_posts())
    @php(the_post())
    @include('partials.entry')
@endwhile

{{-- Secondary loop (from Composer) --}}
@foreach ($featured as $book)
    <article>
        <h2>{{ $book->post_title }}</h2>
        <a href="{{ get_permalink($book->ID) }}">{{ __('Read more', 'sage') }}</a>
    </article>
@endforeach
```

For `@foreach` over WP_Post objects from a Composer, access properties directly — no `the_post()` needed.

---

## REST routes from a service provider

```php
class BooksRestController
{
    public function __construct(
        protected BookRepository $books
    ) {}

    public function registerRoutes(): void
    {
        register_rest_route('acme/v1', '/books', [[
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => [$this, 'index'],
            'permission_callback' => '__return_true',
            'args'                => [
                'per_page' => ['sanitize_callback' => 'absint', 'default' => 10],
            ],
        ]]);
    }

    public function index(\WP_REST_Request $request): \WP_REST_Response
    {
        return rest_ensure_response(
            $this->books->paginate($request->get_param('per_page'))
        );
    }
}
```

Register in `boot()`:
```php
$rest = $this->app->make(BooksRestController::class);
add_action('rest_api_init', [$rest, 'registerRoutes']);
```

---

## Asset enqueuing alongside Vite

Vite owns the main theme CSS/JS via `@vite`. For everything else, use `wp_enqueue_*` in `setup.php`:

```php
// app/setup.php
add_action('wp_enqueue_scripts', function () {
    // Conditional — only on single book pages
    if (is_singular('acme_book')) {
        wp_enqueue_script(
            'acme-gallery',
            get_theme_file_uri('public/gallery.js'),
            [],
            wp_get_theme()->get('Version'),
            ['strategy' => 'defer', 'in_footer' => true]
        );
    }

    // Comment reply
    if (is_singular() && comments_open() && get_option('thread_comments')) {
        wp_enqueue_script('comment-reply');
    }
}, 100);
```

For plugin assets, run Vite inside the plugin separately and enqueue the built output.

---

## Shortcodes rendering Blade

```php
// In ServiceProvider::boot()
add_shortcode('book_card', function (array $atts): string {
    $atts = shortcode_atts(['id' => 0, 'size' => 'medium'], $atts, 'book_card');
    $post = get_post(absint($atts['id']));

    if (! $post || 'acme_book' !== $post->post_type) {
        return '';
    }

    return view('partials.book-card', [
        'post' => $post,
        'size' => sanitize_key($atts['size']),
    ])->render(); // Shortcodes must return, not echo
});
```

---

## Admin pages

**Simple** — render a Blade view from an `add_menu_page` callback:

```php
add_action('admin_menu', function () {
    add_menu_page(
        __('Books', 'acme'),
        __('Books', 'acme'),
        'manage_options',
        'acme-books',
        function () {
            if (! current_user_can('manage_options')) {
                wp_die(esc_html__('Not allowed.', 'acme'));
            }
            echo view('admin.dashboard', [
                'stats' => app(BookRepository::class)->stats(),
            ])->render();
        },
        'dashicons-book'
    );
});
```

**Complex** — use Laravel routing with full controllers (see `acorn-laravel.md`). Only reach for Laravel routing when the page needs complex controller logic that doesn't fit naturally into a single callback.

---

## Nonces in Blade forms + AJAX

```blade
{{-- Blade form --}}
<form method="POST" action="{{ esc_url(admin_url('admin-post.php')) }}">
    @php(wp_nonce_field('acme_save', 'acme_nonce'))
    <input type="hidden" name="action" value="acme_save">
    ...
</form>

{{-- Pass nonce to JS --}}
<script>
window.acmeData = {!! wp_json_encode([
    'nonce'   => wp_create_nonce('acme_ajax'),
    'ajaxUrl' => admin_url('admin-ajax.php'),
    'restUrl' => rest_url('acme/v1'),
    'restNonce' => wp_create_nonce('wp_rest'),
]) !!};
</script>
@vite(['resources/css/app.css', 'resources/js/app.js'])
```

AJAX handler (registered in `boot()`):

```php
add_action('wp_ajax_acme_save', function () {
    check_ajax_referer('acme_ajax', 'nonce');

    if (! current_user_can('edit_posts')) {
        wp_send_json_error(['message' => 'forbidden'], 403);
    }

    $title = sanitize_text_field(wp_unslash($_POST['title'] ?? ''));
    if (! $title) {
        wp_send_json_error(['message' => 'invalid'], 400);
    }

    // do work…
    wp_send_json_success(['title' => $title]);
});
```
