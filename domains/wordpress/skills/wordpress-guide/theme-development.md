# Theme Development (Vanilla WordPress)

Read this for classic or block themes that are **not** Sage-based.
For Sage themes, read `sage-theme.md` instead.

---

## Block theme vs classic theme — choose first

| Build a block theme when | Build or maintain a classic theme when |
|---|---|
| Starting a new project | The existing project is classic and rewriting isn't justified |
| Users will customize templates via the Site Editor | Very specific PHP-driven template logic is required |
| You want native Block Editor / Site Editor integration | WooCommerce templates require it (Woo block support is maturing) |
| Content-focused site (blog, magazine, marketing) | Agency has investment in a classic theme framework |

**Default to block themes for new work.** Classic themes are fully supported and run most of the web, but the ecosystem is moving toward block themes.

---

## Block theme structure

```
my-theme/
├── style.css          # Theme header (required)
├── theme.json         # Global styles + editor settings
├── functions.php      # Hooks, editor styles — minimal
├── templates/         # HTML templates
│   ├── index.html     # Required fallback
│   ├── single.html
│   ├── page.html
│   ├── archive.html
│   ├── 404.html
│   └── search.html
├── parts/             # Reusable template parts
│   ├── header.html
│   └── footer.html
├── patterns/          # Block patterns (PHP for i18n)
├── styles/            # Style variations (alternate theme.json snippets)
└── assets/
```

### `style.css` header

```css
/*
Theme Name:  Acme Block Theme
Version:     1.0.0
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 7.4
License:     GNU General Public License v2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Text Domain: acme
Tags:        full-site-editing, block-patterns, block-styles
*/
```

### Minimal `theme.json` (v3)

```json
{
    "$schema": "https://schemas.wp.org/trunk/theme.json",
    "version": 3,
    "settings": {
        "appearanceTools": true,
        "useRootPaddingAwareAlignments": true,
        "color": {
            "palette": [
                { "slug": "base",     "color": "#ffffff", "name": "Base" },
                { "slug": "contrast", "color": "#111111", "name": "Contrast" },
                { "slug": "primary",  "color": "#0073aa", "name": "Primary" }
            ],
            "custom": false
        },
        "typography": {
            "fontSizes": [
                { "slug": "small",   "size": "0.875rem", "name": "Small" },
                { "slug": "medium",  "size": "1rem",     "name": "Medium" },
                { "slug": "large",   "size": "1.5rem",   "name": "Large" },
                { "slug": "x-large", "size": "2.5rem",   "name": "Extra Large" }
            ],
            "fluid": true
        },
        "layout": {
            "contentSize": "640px",
            "wideSize":    "1200px"
        }
    },
    "styles": {
        "color": {
            "background": "var(--wp--preset--color--base)",
            "text":       "var(--wp--preset--color--contrast)"
        },
        "elements": {
            "link": { "color": { "text": "var(--wp--preset--color--primary)" } },
            "h1":   { "typography": { "fontSize": "var(--wp--preset--font-size--x-large)", "fontWeight": "700" } }
        }
    },
    "templateParts": [
        { "name": "header", "title": "Header", "area": "header" },
        { "name": "footer", "title": "Footer", "area": "footer" }
    ]
}
```

Key `theme.json` notes:
- `"version": 3` — current as of WP 6.6+.
- `$schema` gives editor autocomplete.
- `appearanceTools: true` enables border, link color, spacing, typography controls.
- CSS variables auto-generate from presets: `var(--wp--preset--color--primary)`.
- `"custom": false` locks users to your palette. Use to enforce consistency.

### HTML templates

```html
<!-- templates/single.html -->
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
    <!-- wp:post-title {"level":1} /-->
    <!-- wp:post-featured-image {"align":"wide"} /-->
    <!-- wp:post-content {"layout":{"type":"constrained"}} /-->
</main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
```

Block markup comments are parsed by WordPress — mismatched comments break the editor. Build templates in the Site Editor when possible, then commit the resulting HTML.

### Template hierarchy

`index.html` is the required fallback. WordPress resolves in priority order, e.g. for a single post:
`single-{post-type}-{slug}.html` → `single-{post-type}.html` → `single.html` → `singular.html` → `index.html`

### Block patterns

```php
<?php
// patterns/hero-cta.php
/**
 * Title: Hero with CTA
 * Slug: acme/hero-cta
 * Categories: featured
 */
?>
<!-- wp:cover {"overlayColor":"contrast","minHeight":480} -->
<div class="wp-block-cover">
    ...
</div>
<!-- /wp:cover -->
```

Patterns in `/patterns/*.php` are auto-registered. Use PHP so strings are translatable.

### `functions.php` (minimal for block themes)

```php
<?php
defined( 'ABSPATH' ) || exit;

add_action( 'after_setup_theme', function () {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'editor-styles' );
    add_editor_style( 'assets/css/editor.css' );
    load_theme_textdomain( 'acme', get_template_directory() . '/languages' );
} );

add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( 'acme', get_stylesheet_uri(), [], wp_get_theme()->get( 'Version' ) );
} );
```

---

## Classic theme essentials

```
my-classic-theme/
├── style.css
├── functions.php
├── index.php         # Required fallback
├── header.php
├── footer.php
├── single.php
├── page.php
├── archive.php
├── 404.php
└── template-parts/
```

`functions.php`:

```php
<?php
defined( 'ABSPATH' ) || exit;

add_action( 'after_setup_theme', function () {
    load_theme_textdomain( 'acme', get_template_directory() . '/languages' );
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'automatic-feed-links' );
    add_theme_support( 'html5', [ 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ] );
    add_theme_support( 'align-wide' );
    add_theme_support( 'wp-block-styles' );
    add_theme_support( 'editor-styles' );
    add_editor_style( 'assets/css/editor.css' );
    register_nav_menus( [ 'primary' => __( 'Primary Menu', 'acme' ) ] );
} );

add_action( 'wp_enqueue_scripts', function () {
    $v = wp_get_theme()->get( 'Version' );
    wp_enqueue_style( 'acme-style', get_stylesheet_uri(), [], $v );
    if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
        wp_enqueue_script( 'comment-reply' );
    }
} );
```

The Loop:

```php
<?php if ( have_posts() ) : ?>
    <?php while ( have_posts() ) : the_post(); ?>
        <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
            <h1><?php the_title(); ?></h1>
            <div class="entry-content"><?php the_content(); ?></div>
        </article>
    <?php endwhile; ?>
    <?php the_posts_pagination(); ?>
<?php else : ?>
    <p><?php esc_html_e( 'Nothing found.', 'acme' ); ?></p>
<?php endif; ?>
```

---

## Child themes

Never edit a third-party theme directly — use a child theme.

`style.css`:
```css
/*
Theme Name: Acme Child
Template:   parent-theme-folder
Version:    1.0.0
*/
```

For block themes: override any template by placing a matching file in the child theme's `templates/` directory. For classic themes: copy only the files you need to override; use `functions.php` hooks for the rest.

---

## `theme.json` gotchas

- `"custom": false` in `color` removes the free-form color picker; users are locked to your palette.
- Presets removed from the JSON don't disappear from the editor — you need `"palette": []` to clear.
- Font loading via `theme.json`'s `fontFace` auto-generates `@font-face` rules; prefer it over manual enqueuing.
- Block editor styles ≠ frontend styles. If the editor looks different from the frontend, use `add_editor_style()`.
