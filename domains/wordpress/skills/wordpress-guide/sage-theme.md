# Sage Theme Development

Read this when working on a **Roots Sage** theme (not a vanilla WP theme).
Current version: **Sage 11** (Vite + Acorn v6, PHP 8.3+).

---

## Quick version check

```bash
cat composer.json | grep roots/sage   # version
ls vite.config.js                      # Sage 11 — Vite
ls bud.config.js                       # Sage 10 — Bud.js (different pipeline)
```

Sage 10 and Sage 11 have different asset pipelines. If you see `bud.config.js`, treat asset commands and config differently.

---

## Directory structure (Sage 11)

```
your-theme/
├── app/                      # PHP — all functionality
│   ├── Providers/
│   │   └── ThemeServiceProvider.php
│   ├── View/
│   │   └── Composers/        # View composers — data → Blade views
│   ├── filters.php           # WordPress output filters
│   └── setup.php             # Theme supports, menus, image sizes
├── public/                   # Compiled assets — never edit, never commit
├── resources/
│   ├── css/app.css           # Tailwind entry
│   ├── js/app.js             # JS entry
│   ├── fonts/
│   ├── images/
│   └── views/                # Blade templates
│       ├── components/       # x-component-name
│       ├── layouts/          # Base layouts (app.blade.php)
│       └── partials/         # Included partials
├── storage/                  # Acorn cache — writable, never commit
├── vendor/                   # Composer packages — never commit
├── composer.json
├── functions.php             # Boot Acorn only — no logic here
├── index.php                 # WordPress stub — do not edit
├── package.json
├── style.css                 # Theme header
├── tailwind.config.js
└── vite.config.js
```

---

## `functions.php` — boot only

```php
<?php
use Roots\Acorn\Application;

if (! class_exists(Application::class)) {
    wp_die(__('You need to install Acorn to use this theme.', 'sage'), '', [
        'link_url'  => 'https://roots.io/acorn/docs/installation/',
        'link_text' => __('Acorn Docs: Installation', 'sage'),
    ]);
}

add_action('after_setup_theme', function () {
    Application::configure()
        ->withProviders([
            App\Providers\ThemeServiceProvider::class,
        ])
        ->boot();
}, 0);
```

**Do not add theme logic here.** `setup.php`, `filters.php`, and service providers own that.

---

## `app/setup.php` — WordPress theme config

This is where classic `functions.php` content lives. Loaded by `ThemeServiceProvider`:

```php
<?php
namespace App;

add_action('after_setup_theme', function () {
    load_theme_textdomain('sage', get_template_directory() . '/resources/lang');

    add_theme_support('automatic-feed-links');
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['caption', 'comment-form', 'comment-list', 'gallery', 'caption', 'script', 'style']);
    add_theme_support('align-wide');
    add_theme_support('wp-block-styles');
    add_theme_support('editor-styles');
    add_theme_support('responsive-embeds');

    register_nav_menus([
        'primary_navigation' => __('Primary Navigation', 'sage'),
    ]);
}, 20);

add_action('widgets_init', function () {
    register_sidebar([
        'name' => __('Primary', 'sage'),
        'id'   => 'sidebar-primary',
        'before_widget' => '<section class="widget %1$s %2$s">',
        'after_widget'  => '</section>',
        'before_title'  => '<h3>',
        'after_title'   => '</h3>',
    ]);
});

add_image_size('card', 600, 400, true);
```

---

## `app/filters.php` — WordPress filters

```php
<?php
namespace App;

add_filter('body_class', function (array $classes) {
    return collect($classes)->push('no-js')->unique()->values()->all();
});

add_filter('embed_oembed_html', function ($cache) {
    return '<div class="responsive-embed">' . $cache . '</div>';
}, 10, 4);
```

---

## Template hierarchy in Sage

WordPress template hierarchy still applies — `.blade.php` files in `resources/views/` replace `.php` at the theme root:

| WordPress resolution | Sage file |
|---|---|
| `index.php` | `resources/views/index.blade.php` |
| `single.php` | `resources/views/single.blade.php` |
| `single-{post-type}.php` | `resources/views/single-{post-type}.blade.php` |
| `page.php` | `resources/views/page.blade.php` |
| `archive.php` | `resources/views/archive.blade.php` |
| `archive-{type}.php` | `resources/views/archive-{type}.blade.php` |
| `404.php` | `resources/views/404.blade.php` |
| `search.php` | `resources/views/search.blade.php` |

---

## Base layout

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!doctype html>
<html {!! get_language_attributes() !!}>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    @php(wp_head())
  </head>
  <body @php(body_class())>
    @php(wp_body_open())
    @include('partials.header')
    <main id="main">@yield('content')</main>
    @include('partials.footer')
    @php(wp_footer())
  </body>
</html>
```

Note: `{!! get_language_attributes() !!}` uses raw output because WordPress returns trusted HTML attributes. `{{ }}` would double-escape them.

## Page view

```blade
{{-- resources/views/page.blade.php --}}
@extends('layouts.app')

@section('content')
  @while(have_posts()) @php(the_post())
    <article @php(post_class('container py-12'))>
      <h1>{{ get_the_title() }}</h1>
      <div class="prose">@php(the_content())</div>
    </article>
  @endwhile
@endsection
```

`@php(the_content())` — `the_content()` echoes directly and runs through WP's full filter chain (blocks, shortcodes, `wpautop`). Don't wrap in `{{ }}`.

---

## Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
import { wordpressPlugin, wordpressTheme } from '@roots/vite-plugin';

export default defineConfig({
    base: '/app/themes/your-theme/public/',
    plugins: [
        wordpressPlugin(),
        wordpressTheme({ dir: import.meta.dirname }),
    ],
    build: {
        manifest: 'manifest.json',
        outDir: 'public',
        rollupOptions: {
            input: ['resources/css/app.css', 'resources/js/app.js'],
        },
    },
});
```

```bash
npm run dev    # Start Vite dev server (HMR)
npm run build  # Build to public/ for production
```

## `@vite` directive

```blade
{{-- In layout <head> --}}
@vite(['resources/css/app.css', 'resources/js/app.js'])
```

In dev: points to Vite HMR server. In production: reads `public/manifest.json` for fingerprinted paths. You never manually enqueue the main CSS/JS.

---

## Tailwind CSS

```js
// tailwind.config.js
export default {
    content: ['./resources/**/*.blade.php', './resources/**/*.js'],
    theme: { extend: {} },
    plugins: [],
};
```

```css
/* resources/css/app.css */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

@layer components {
    .btn { @apply inline-flex items-center px-4 py-2 rounded-md font-medium; }
    .btn-primary { @apply btn bg-blue-600 text-white hover:bg-blue-700; }
}
```

To load Tailwind in the Block Editor:
```php
// app/setup.php
add_action('after_setup_theme', function () {
    add_editor_style(get_theme_file_uri('public/app.css'));
});
```

---

## Deployment checklist

- [ ] `npm run build` runs before deploy (`public/` must exist and be current)
- [ ] `composer install --no-dev` on server
- [ ] `wp acorn cache:clear` after deploy
- [ ] `storage/` directory is writable by web server
- [ ] PHP 8.3+ on the server (Acorn v6 requirement)
- [ ] `node_modules/`, `storage/`, `vendor/` excluded from git (already in `.gitignore`)
- [ ] `.env` is on server but not in git
