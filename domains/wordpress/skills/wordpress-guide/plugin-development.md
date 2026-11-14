# Plugin Development

Read this when building or modifying a **vanilla WordPress plugin** (not Acorn-powered).
For Acorn-based plugins, read `service-providers.md` instead — this file covers the
WordPress-native approach.

---

## Plugin header

```php
<?php
/**
 * Plugin Name:       Acme Widget
 * Plugin URI:        https://example.com/acme-widget
 * Description:       A helpful widget.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://example.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       acme-widget
 * Domain Path:       /languages
 */

defined( 'ABSPATH' ) || exit;
```

`Text Domain` must match the plugin folder slug.

---

## Recommended file structure

```
acme-widget/
├── acme-widget.php          # Header, constants, bootstrap only
├── uninstall.php            # Runs on plugin deletion
├── composer.json            # Autoload + dev deps
├── src/
│   ├── Plugin.php           # Main plugin class
│   ├── Settings/
│   ├── Admin/
│   ├── Frontend/
│   └── REST/
├── assets/css/ js/ images/
├── languages/
└── tests/
```

`acme-widget.php` — keep thin:

```php
defined( 'ABSPATH' ) || exit;

define( 'ACME_VERSION', '1.0.0' );
define( 'ACME_FILE',    __FILE__ );
define( 'ACME_DIR',     plugin_dir_path( __FILE__ ) );
define( 'ACME_URL',     plugin_dir_url( __FILE__ ) );

if ( file_exists( ACME_DIR . 'vendor/autoload.php' ) ) {
    require ACME_DIR . 'vendor/autoload.php';
}

register_activation_hook(   __FILE__, [ 'Acme\\Widget\\Plugin', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'Acme\\Widget\\Plugin', 'deactivate' ] );

add_action( 'plugins_loaded', static fn () => \Acme\Widget\Plugin::instance()->init() );
```

---

## Lifecycle hooks

### Activation
```php
public static function activate(): void {
    // Default options
    add_option( 'acme_settings', [ 'enabled' => true ], '', false ); // autoload=false

    // Schedule cron
    if ( ! wp_next_scheduled( 'acme_daily_sync' ) ) {
        wp_schedule_event( time(), 'daily', 'acme_daily_sync' );
    }

    // Create custom tables (see database.md)
    self::create_tables();

    flush_rewrite_rules(); // Only if you registered CPTs/rewrites
}
```

### Deactivation
```php
public static function deactivate(): void {
    wp_clear_scheduled_hook( 'acme_daily_sync' );
    flush_rewrite_rules();
    // DO NOT delete user data here
}
```

### Uninstall — `uninstall.php`
```php
<?php
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

// Only clean up if user opted in
if ( ! get_option( 'acme_remove_data_on_uninstall' ) ) {
    return;
}

delete_option( 'acme_settings' );
delete_option( 'acme_version' );

global $wpdb;
$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}acme_logs" );
```

---

## Hook timing

Key hooks in chronological order:

- `plugins_loaded` — All plugins loaded. **First safe hook for plugin init.**
- `init` — WP fully initialized. Register CPTs, taxonomies, shortcodes, REST routes.
- `admin_menu` — Register admin menu pages.
- `admin_init` — Admin initialized; process form submissions here.
- `wp_enqueue_scripts` — Frontend assets.
- `admin_enqueue_scripts` — Admin assets.
- `rest_api_init` — Register REST routes.
- `save_post`, `delete_post` — Post save/delete events.
- `shutdown` — Request ending.

---

## Custom post types

```php
add_action( 'init', function () {
    register_post_type( 'acme_book', [
        'labels'          => [
            'name'          => __( 'Books', 'acme' ),
            'singular_name' => __( 'Book', 'acme' ),
        ],
        'public'          => true,
        'show_in_rest'    => true,   // Required for Block Editor
        'rest_base'       => 'books',
        'menu_icon'       => 'dashicons-book',
        'supports'        => [ 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ],
        'has_archive'     => true,
        'rewrite'         => [ 'slug' => 'books' ],
    ] );
} );
```

After registering or changing a CPT, flush rewrite rules once (Permalinks screen or activation hook). **Never call `flush_rewrite_rules()` on every request** — it's expensive.

---

## Storage decision matrix

| What you need | Use |
|---|---|
| Site-wide plugin settings | `wp_options` (autoload=false if > ~50 KB) |
| Cached values with TTL | Transients |
| Data attached to a post | Post meta |
| Data attached to a user | User meta |
| Data attached to a term | Term meta |
| Large / queryable / growing dataset | Custom table |

**Autoload trap:** `add_option` and `update_option` default to autoload=yes. This means the value is fetched on every page load. Always pass `false` for the autoload argument on anything non-trivial:

```php
update_option( 'acme_big_data', $data, false ); // false = don't autoload
add_option( 'acme_big_data', $data, '', false );
```

---

## Settings API

```php
add_action( 'admin_init', function () {
    register_setting( 'acme_options', 'acme_settings', [
        'sanitize_callback' => 'acme_sanitize_settings',
        'default'           => [ 'enabled' => true ],
    ] );
    add_settings_section( 'acme_main', __( 'Settings', 'acme' ), '__return_false', 'acme' );
    add_settings_field( 'acme_enabled', __( 'Enable', 'acme' ), 'acme_render_enabled', 'acme', 'acme_main' );
} );

add_action( 'admin_menu', function () {
    add_options_page( __( 'Acme', 'acme' ), __( 'Acme', 'acme' ), 'manage_options', 'acme', function () {
        if ( ! current_user_can( 'manage_options' ) ) return;
        ?>
        <div class="wrap">
            <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
            <form action="options.php" method="post">
                <?php settings_fields( 'acme_options' ); do_settings_sections( 'acme' ); submit_button(); ?>
            </form>
        </div>
        <?php
    } );
} );
```

---

## Asset enqueuing

```php
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_singular( 'acme_book' ) ) return; // Don't load on every page

    wp_enqueue_style( 'acme', ACME_URL . 'assets/css/plugin.css', [], ACME_VERSION );
    wp_enqueue_script( 'acme', ACME_URL . 'assets/js/plugin.js', [], ACME_VERSION,
        [ 'strategy' => 'defer', 'in_footer' => true ]
    );
    wp_localize_script( 'acme', 'acmeData', [
        'restUrl' => esc_url_raw( rest_url( 'acme/v1' ) ),
        'nonce'   => wp_create_nonce( 'wp_rest' ),
    ] );
} );

add_action( 'admin_enqueue_scripts', function ( $hook ) {
    if ( 'settings_page_acme' !== $hook ) return;
    wp_enqueue_script( 'acme-admin', ACME_URL . 'assets/js/admin.js', [], ACME_VERSION, true );
} );
```

---

## Internationalization

```php
// Text domain loading (for private plugins — .org plugins auto-load from WP 4.6)
add_action( 'init', fn () => load_plugin_textdomain( 'acme', false, dirname( plugin_basename( ACME_FILE ) ) . '/languages' ) );

// Usage
__( 'String', 'acme' );
_e( 'Echoed string', 'acme' );
esc_html__( 'Safe output', 'acme' );
_n( '%s book', '%s books', $count, 'acme' );
printf( /* translators: %s: username */ esc_html__( 'Hello, %s', 'acme' ), esc_html( $name ) );
```

---

## Distribution checklist

- [ ] Header complete (Plugin Name, Version, Requires PHP, Requires at least, License, Text Domain)
- [ ] No `var_dump`, `print_r`, `error_log`, `console.log` left in
- [ ] All user-facing strings translated with correct text domain
- [ ] All output escaped; all input sanitized (run PHPCS with WordPress-Extra)
- [ ] `uninstall.php` handles cleanup
- [ ] No hardcoded paths — use `plugin_dir_path( __FILE__ )` and URL helpers
- [ ] Tested against minimum PHP and WP versions declared in header
- [ ] `vendor/` included in zip (or autoload bundled); `node_modules/`, sourcemaps excluded
