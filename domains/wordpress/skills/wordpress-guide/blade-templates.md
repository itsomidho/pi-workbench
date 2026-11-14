# Blade Templates & View Composers

Read this when working with `.blade.php` files, building components, or wiring data to views in a Sage/Acorn project.

---

## Blade syntax essentials

```blade
{{-- Auto-escaped — safe for all user data --}}
{{ $title }}
{{ $post->post_title }}
{{ __('Translated', 'sage') }}

{{-- Raw unescaped HTML — only for pre-sanitized content --}}
{!! get_language_attributes() !!}
{!! wp_kses_post($description) !!}
{!! apply_filters('the_content', get_the_content()) !!}

{{-- Default value if null --}}
{{ $subtitle ?? '' }}

{{-- Inline PHP --}}
@php($post_id = get_the_ID())
@php
    $class = $featured ? 'card--featured' : 'card';
@endphp

{{-- Blade comment — not rendered in HTML --}}
{{-- This is a comment --}}
```

**The rule**: `{{ }}` = always safe. `{!! !!}` = only for HTML you've already sanitized.

---

## Control structures

```blade
@if ($condition)
    ...
@elseif ($other)
    ...
@else
    ...
@endif

@unless ($isHidden)
    <div>Visible when $isHidden is false</div>
@endunless

@foreach ($books as $book)
    <li>{{ $book->post_title }}</li>
@endforeach

@forelse ($posts as $post)
    @include('partials.entry')
@empty
    <p>{{ __('No results.', 'sage') }}</p>
@endforelse

@while(have_posts())
    @php(the_post())
    @include('partials.entry')
@endwhile
```

---

## Layouts and sections

```blade
{{-- layouts/app.blade.php --}}
<html>
  <body>
    @yield('content')
    @yield('scripts', '')  {{-- with default --}}
  </body>
</html>

{{-- page.blade.php --}}
@extends('layouts.app')

@section('content')
    <main>...</main>
@endsection
```

---

## Includes and stacks

```blade
@include('partials.header')
@include('partials.card', ['post' => $post])
@includeIf('partials.sidebar')      {{-- only if view exists --}}

{{-- In layout: --}}
@stack('scripts')

{{-- In a partial: --}}
@push('scripts')
    <script src="..." defer></script>
@endpush
```

---

## WordPress functions in Blade

```blade
{{-- Functions that echo directly — use @php wrapper --}}
@php(the_content())
@php(dynamic_sidebar('sidebar-primary'))
@php(wp_nav_menu(['theme_location' => 'primary_navigation']))

{{-- Functions that return — can use {{ }} or capture --}}
{{ get_the_title() }}
{{ get_the_excerpt() }}

{{-- Capture a function's return for raw output --}}
@php($menu = wp_nav_menu(['theme_location' => 'primary_navigation', 'echo' => false]))
{!! $menu !!}

{{-- Attributes that return trusted HTML --}}
{!! get_language_attributes() !!}
{!! post_class('additional-class') !!}
```

---

## View Composers

View Composers bind data to Blade views before they render. This is the Sage way to supply PHP data to templates — not globals, not `wp_localize_script`, not shared state.

### Scaffold
```bash
wp acorn make:composer PageHeader
# Creates: app/View/Composers/PageHeader.php
```

### Basic Composer
```php
// app/View/Composers/PageHeader.php
namespace App\View\Composers;

use Roots\Acorn\View\Composer;

class PageHeader extends Composer
{
    /**
     * Views this Composer is bound to.
     * (Optional if auto-binding applies — see below.)
     */
    protected static $views = [
        'partials.page-header',
    ];

    /**
     * Data returned here becomes $variables in the template.
     */
    public function with(): array
    {
        return [
            'title'    => $this->resolveTitle(),
            'subtitle' => get_field('subtitle') ?: null,
        ];
    }

    protected function resolveTitle(): string
    {
        if (is_front_page()) return get_bloginfo('name', 'display');
        if (is_archive())    return get_the_archive_title();
        return get_the_title();
    }
}
```

### Auto-binding by name

If view and Composer share matching path segments (kebab-case → PascalCase), Sage binds them automatically — no `$views` property needed:

| View | Composer (auto-bound) |
|---|---|
| `resources/views/partials/page-header.blade.php` | `app/View/Composers/PageHeader.php` |
| `resources/views/partials/post-card.blade.php` | `app/View/Composers/PostCard.php` |
| `resources/views/single.blade.php` | `app/View/Composers/Single.php` |

### `with()` vs `override()`

`with()` merges data — `@include('partials.card', ['title' => 'Passed in'])` wins over what `with()` returns for the same key.

`override()` replaces data regardless of what was passed to the view — the Composer always wins.

### Accessing inherited data

```php
public function with(): array
{
    $post_id = $this->data->get('post_id') ?? get_the_ID();

    return [
        'thumbnail' => get_the_post_thumbnail_url($post_id, 'large'),
        'excerpt'   => get_the_excerpt($post_id),
    ];
}
```

### Real-world example

```php
// app/View/Composers/Archive.php
namespace App\View\Composers;

use Roots\Acorn\View\Composer;

class Archive extends Composer
{
    protected static $views = ['archive', 'archive-acme_book'];

    public function with(): array
    {
        return [
            'title'      => get_the_archive_title(),
            'pagination' => get_the_posts_pagination([
                'prev_text' => __('Prev', 'sage'),
                'next_text' => __('Next', 'sage'),
            ]),
        ];
    }
}
```

```blade
{{-- resources/views/archive.blade.php --}}
@extends('layouts.app')

@section('content')
    <h1>{{ $title }}</h1>

    @while(have_posts()) @php(the_post())
        @include('partials.entry')
    @endwhile

    {!! $pagination !!}
@endsection
```

---

## Blade Components

### Anonymous (view-only)
```blade
{{-- resources/views/components/button.blade.php --}}
@props(['type' => 'button', 'variant' => 'primary'])

<button type="{{ $type }}" class="btn btn--{{ $variant }}" {{ $attributes }}>
    {{ $slot }}
</button>
```

Usage:
```blade
<x-button variant="secondary" class="mt-4">{{ __('Save', 'sage') }}</x-button>
```

`$attributes` merges any extra HTML attributes. `$slot` is the content between the tags.

### Class-backed
```bash
wp acorn make:component Alert
```

```php
// app/View/Components/Alert.php
namespace App\View\Components;

use Illuminate\View\Component;

class Alert extends Component
{
    public function __construct(
        public string $type = 'info',
        public ?string $title = null,
    ) {}

    public function render()
    {
        return view('components.alert');
    }
}
```

```blade
<x-alert type="success" title="{{ __('Saved!', 'sage') }}">
    {{ __('Your changes have been saved.', 'sage') }}
</x-alert>
```

### Named slots
```blade
{{-- resources/views/components/card.blade.php --}}
<div class="card">
    <div class="card__header">{{ $header }}</div>
    <div class="card__body">{{ $slot }}</div>
    @isset($footer)<div class="card__footer">{{ $footer }}</div>@endisset
</div>
```

```blade
<x-card>
    <x-slot name="header"><h2>{{ $post_title }}</h2></x-slot>
    <p>{{ $excerpt }}</p>
    <x-slot name="footer"><a href="{{ $url }}">Read more</a></x-slot>
</x-card>
```

---

## Common gotchas

- **Don't use `<?php ?>` in `.blade.php`** — use `@php` blocks instead.
- **`{{ get_the_content() }}`** double-processes and double-escapes. Use `@php(the_content())` or `{!! apply_filters('the_content', get_the_content()) !!}`.
- **`__DIR__` inside Blade** resolves to the compiled cache directory, not your theme. Use `get_theme_file_uri()` for paths.
- **Composer not firing?** Run `wp acorn cache:clear`. Acorn caches Composer discovery.
- **Components vs Composers**: components are reusable UI units (`<x-button>`). Composers supply data to named views. They're complementary — a component can also have a Composer.
