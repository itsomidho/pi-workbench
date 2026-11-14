# Laravel Features via Acorn

Acorn unlocks Laravel features inside WordPress. PHP 8.3+ required (Acorn v6).

---

## Laravel Cache

Better than WP transients for complex caching needs. Uses WP's object cache by default; swap to Redis via config.

```php
use Illuminate\Support\Facades\Cache;

// Remember: get or compute-and-cache
$books = Cache::remember('featured_books', HOUR_IN_SECONDS, function () {
    return get_posts(['post_type' => 'book', 'meta_key' => '_featured', 'meta_value' => '1', 'no_found_rows' => true]);
});

// Put / get / forget
Cache::put('api_token', $token, 30 * MINUTE_IN_SECONDS);
$token = Cache::get('api_token');
Cache::forget('api_token');

// Has
if (Cache::has('api_token')) { ... }

// Forever (no expiry)
Cache::forever('site_config', $config);

// Invalidate on save
add_action('save_post_book', fn ($id) => Cache::forget("book_{$id}"));
```

Configure driver in `config/cache.php`:
```php
return [
    'default' => env('CACHE_DRIVER', 'wordpress'), // 'redis', 'file', 'array'
    'stores'  => [
        'wordpress' => ['driver' => 'wordpress'],
        'redis'     => ['driver' => 'redis', 'connection' => 'default'],
    ],
];
```

---

## Eloquent ORM

Maps to database tables. Acorn wires Eloquent to WP's `$wpdb` connection automatically.

### Mapping to `wp_posts`

```php
namespace Acme\Books\Models;

use Illuminate\Database\Eloquent\Model;

class Book extends Model
{
    protected $table      = 'wp_posts'; // Hardcode with prefix
    protected $primaryKey = 'ID';
    public    $timestamps = false;      // WP uses post_date, not created_at/updated_at

    protected static function booted(): void
    {
        static::addGlobalScope('type', fn ($q) =>
            $q->where('post_type', 'book')->where('post_status', 'publish')
        );
    }

    public function meta(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PostMeta::class, 'post_id', 'ID');
    }

    public function getMeta(string $key): mixed
    {
        return $this->meta->firstWhere('meta_key', $key)?->meta_value;
    }
}
```

### Custom tables

```php
class BookLog extends Model
{
    protected $table    = 'acme_book_logs';
    protected $fillable = ['book_id', 'event', 'user_id', 'context'];
    protected $casts    = ['context' => 'array', 'created_at' => 'datetime'];
}
```

**Performance note**: Eloquent adds overhead over `$wpdb`. For high-volume queries, `$wpdb` remains appropriate. Use Eloquent where ORM clarity is worth the cost.

**SQL safety**: Eloquent's `where()` is parameterized. Never interpolate in `whereRaw`:
```php
// Wrong — SQL injection
BookLog::whereRaw("user_id = {$user_id}")->get();
// Right
BookLog::where('user_id', $user_id)->get();
```

---

## Migrations

Laravel-style schema management — cleaner than `dbDelta`.

```bash
wp acorn make:migration create_book_logs_table
```

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('acme_book_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('book_id')->index();
            $table->string('event', 50)->index();
            $table->unsignedBigInteger('user_id')->default(0)->index();
            $table->json('context')->nullable();
            $table->string('ip_address', 45)->default('');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('acme_book_logs');
    }
};
```

```bash
wp acorn migrate
wp acorn migrate:status
wp acorn migrate:rollback
wp acorn migrate:fresh   # Drop all + re-migrate (dev only)
```

Run migrations on plugin update:
```php
// In ServiceProvider::boot()
add_action('plugins_loaded', function () {
    if (get_option('acme_db_version') !== ACME_VERSION) {
        app()->make(\Illuminate\Database\Migrations\Migrator::class)
            ->run([plugin_dir_path(ACME_FILE) . 'database/migrations']);
        update_option('acme_db_version', ACME_VERSION, false);
    }
});
```

---

## Laravel Routing

Sits alongside WordPress routing. Best for complex controller-driven admin interfaces or custom front-end paths.

```php
// routes/web.php
use Illuminate\Support\Facades\Route;

Route::get('/books/catalog', function () {
    return view('acme-books::catalog', ['books' => Book::paginate(20)]);
});

Route::post('/books/import', [\Acme\Books\Http\Controllers\ImportController::class, 'handle'])
    ->middleware('auth');
```

Wire in boot:
```php
Application::configure()
    ->withProviders([...])
    ->withRouting(
        web: plugin_dir_path(ACME_FILE) . 'routes/web.php',
        wordpress: true, // Keep WordPress routing intact
    )
    ->boot();
```

**Use with restraint.** For simple admin pages, `add_menu_page` + a standard callback is clearer and more compatible with multisite, capabilities, and third-party plugins.

---

## Livewire

Interactive UI components in PHP without writing JavaScript.

```bash
composer require roots/acorn-livewire
wp acorn make:livewire BookSearch
```

```php
// app/Livewire/BookSearch.php
namespace App\Livewire;

use Livewire\Component;

class BookSearch extends Component
{
    public string $query = '';

    public function mount(): void
    {
        abort_unless(current_user_can('read'), 403);
    }

    public function render()
    {
        return view('livewire.book-search', [
            'books' => get_posts(['post_type' => 'book', 's' => $this->query, 'posts_per_page' => 10]),
        ]);
    }
}
```

```blade
{{-- resources/views/livewire/book-search.blade.php --}}
<div>
    <input type="text" wire:model.live="query" placeholder="{{ __('Search…', 'sage') }}">
    @foreach ($books as $book)
        <p>{{ $book->post_title }}</p>
    @endforeach
</div>
```

```blade
@livewire('book-search')
```

Always check capabilities in `mount()` — Livewire has its own AJAX and doesn't go through `admin-ajax.php`.

---

## Custom console commands

```bash
wp acorn make:console SyncBooks
```

```php
namespace Acme\Books\Console;

use Roots\Acorn\Console\Command;

class SyncBooksCommand extends Command
{
    protected $signature   = 'books:sync {--dry-run : Simulate without writing}';
    protected $description = 'Sync books from the external API';

    public function __construct(protected BookSyncService $sync)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = $this->option('dry-run');
        $this->info('Starting sync…');

        $bar   = $this->output->createProgressBar();
        $count = $this->sync->run(dry: $dryRun, progress: $bar);
        $bar->finish();

        $this->newLine();
        $this->info(sprintf('%s %d books.', $dryRun ? 'Would sync' : 'Synced', $count));

        return self::SUCCESS;
    }
}
```

Register in `ServiceProvider::boot()`:
```php
if (defined('WP_CLI') && WP_CLI) {
    $this->commands([\Acme\Books\Console\SyncBooksCommand::class]);
}
```

```bash
wp acorn books:sync
wp acorn books:sync --dry-run
```

---

## Logging

```php
use Illuminate\Support\Facades\Log;

Log::info('Book imported', ['id' => $id, 'title' => $title]);
Log::warning('Rate limit approaching', ['remaining' => $rate]);
Log::error('Sync failed', ['exception' => $e->getMessage()]);
```

Writes to `storage/logs/wordpress.log` by default. Configure channels in `config/logging.php`.

---

## Tinker (interactive REPL)

```bash
wp acorn tinker
```

Gives you an interactive PHP shell with the full WP + Laravel container available. Invaluable for inspecting objects, testing queries, and running one-off operations in development.
