# Service Providers & Acorn Container

Read this when building Acorn-powered plugins, wiring services, or managing application logic in a Sage theme or custom plugin.

---

## Boot patterns

### In a Sage theme (`functions.php`)

```php
add_action('after_setup_theme', function () {
    Application::configure()
        ->withProviders([
            App\Providers\ThemeServiceProvider::class,
        ])
        ->boot();
}, 0);
```

### In a standalone plugin (main plugin file)

```php
use Roots\Acorn\Application;

defined('ABSPATH') || exit;

if (! class_exists(Application::class)) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p>'
           . esc_html__('This plugin requires Acorn.', 'acme')
           . '</p></div>';
    });
    return;
}

add_action('after_setup_theme', function () {
    Application::configure()
        ->withProviders([
            Acme\Books\Providers\BooksServiceProvider::class,
        ])
        ->boot();
}, 1); // Priority 1 = after theme (priority 0)
```

Run once after install:
```bash
wp acorn acorn:install   # Adds post-autoload-dump script to composer.json
```

Or add manually to `composer.json`:
```json
"scripts": {
    "post-autoload-dump": [
        "Roots\\Acorn\\ComposerScripts::postAutoloadDump"
    ]
}
```

---

## Service provider anatomy

```php
namespace Acme\Books\Providers;

use Roots\Acorn\ServiceProvider;

class BooksServiceProvider extends ServiceProvider
{
    /**
     * register() — bind things to the container.
     * Runs BEFORE WordPress is fully loaded.
     * DO NOT call WordPress functions, run queries, or add hooks here.
     */
    public function register(): void
    {
        // Bind interface to implementation
        $this->app->bind(
            BookRepositoryInterface::class,
            BookRepository::class
        );

        // Singleton: same instance on every resolve
        $this->app->singleton(BookRepository::class, function ($app) {
            return new BookRepository(cache_prefix: 'acme_books_');
        });

        // Merge plugin config defaults
        $this->mergeConfigFrom(
            plugin_dir_path(ACME_FILE) . 'config/books.php',
            'books'
        );
    }

    /**
     * boot() — wire up side effects.
     * WordPress is available here. This is where hooks live.
     */
    public function boot(): void
    {
        $postType = $this->app->make(BookPostType::class);
        $rest     = $this->app->make(BooksRestController::class);

        add_action('init',          [$postType, 'register']);
        add_action('rest_api_init', [$rest,     'registerRoutes']);

        // Load plugin Blade views
        $this->loadViewsFrom(
            plugin_dir_path(ACME_FILE) . 'resources/views',
            'acme-books'
        );

        // CLI commands
        if (defined('WP_CLI') && WP_CLI) {
            $this->commands([
                \Acme\Books\Console\SyncBooksCommand::class,
            ]);
        }
    }
}
```

**`register()` ≠ `boot()`** — this is the most important distinction. Calling WordPress functions in `register()` is undefined behavior; the WP environment isn't ready yet.

---

## ThemeServiceProvider in Sage

In a Sage theme, `ThemeServiceProvider` extends `SageServiceProvider`. Always call `parent::register()` and `parent::boot()` — these wire up Blade and Composer auto-discovery:

```php
namespace App\Providers;

use Roots\Acorn\Sage\SageServiceProvider;

class ThemeServiceProvider extends SageServiceProvider
{
    public function register(): void
    {
        parent::register();

        $this->app->singleton(\App\Services\BookRepository::class);
    }

    public function boot(): void
    {
        parent::boot(); // Required — don't remove

        add_filter('nav_menu_item_title', function ($title) {
            return $title;
        });
    }
}
```

If you omit `parent::boot()`, Blade Composer auto-discovery breaks.

---

## Service container

```php
// Resolve anywhere in WP context
$repo = app(BookRepositoryInterface::class);

// Or:
$repo = resolve(BookRepositoryInterface::class);

// Constructor injection — happens automatically for classes resolved through the container
class BooksRestController
{
    public function __construct(
        protected BookRepository $books,      // Injected automatically
        protected CacheInterface $cache,       // Injected automatically
    ) {}
}
```

### Binding patterns

```php
// New instance every resolve
$this->app->bind(Interface::class, Implementation::class);

// Same instance every resolve
$this->app->singleton(MyService::class, fn ($app) => new MyService(...));

// Already-created object
$this->app->instance(MyService::class, $existingObject);

// Contextual: different implementation for a specific class
$this->app
    ->when(BooksController::class)
    ->needs(CacheInterface::class)
    ->give(RedisCache::class);
```

---

## Config files

```php
// config/books.php
return [
    'per_page' => env('BOOKS_PER_PAGE', 10),
    'api_url'  => env('BOOKS_API_URL', 'https://api.example.com'),
    'cache_ttl'=> env('BOOKS_CACHE_TTL', HOUR_IN_SECONDS),
];
```

```php
// Access anywhere
$perPage = config('books.per_page');
```

Merge plugin defaults in `register()`:
```php
$this->mergeConfigFrom(plugin_dir_path(ACME_FILE) . 'config/books.php', 'books');
```

After editing config files: `wp acorn config:cache` (production) or `wp acorn cache:clear` (dev).

---

## Plugin structure with Acorn

```
acme-books/
├── acme-books.php             # Header + Acorn boot
├── composer.json              # PSR-4 autoload + post-autoload-dump script
├── config/books.php
├── resources/views/           # Blade views (optional in plugins)
├── src/
│   ├── Providers/
│   │   └── BooksServiceProvider.php
│   ├── PostTypes/
│   │   └── BookPostType.php
│   ├── REST/
│   │   └── BooksRestController.php
│   ├── Services/
│   │   ├── BookRepositoryInterface.php
│   │   └── BookRepository.php
│   └── Console/
│       └── SyncBooksCommand.php
├── storage/                   # Acorn cache — writable, not in git
└── tests/
```

`composer.json`:
```json
{
    "require": { "roots/acorn": "^6.0" },
    "autoload": { "psr-4": { "Acme\\Books\\": "src/" } },
    "scripts": {
        "post-autoload-dump": ["Roots\\Acorn\\ComposerScripts::postAutoloadDump"]
    }
}
```

---

## `wp acorn` scaffolding reference

```bash
wp acorn make:composer PageHeader          # View Composer
wp acorn make:provider BooksServiceProvider
wp acorn make:component Button             # Blade component
wp acorn make:console SyncBooks           # Console command
wp acorn make:migration create_books_table

wp acorn cache:clear                       # Clear all Acorn caches
wp acorn view:clear                        # Clear compiled Blade views
wp acorn config:cache                      # Cache config (production)
wp acorn migrate                           # Run pending migrations
wp acorn list                              # All available commands
wp acorn tinker                            # Interactive REPL (dev)
```

After adding or removing providers, always `wp acorn cache:clear`.
