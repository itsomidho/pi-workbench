# Coding Standards

Read this when writing PHP, JavaScript, or CSS for a WordPress project, or when setting up linting. Also applies to Roots projects — WPCS for PHP, `@wordpress/scripts` for JS.

---

## PHP — WordPress Coding Standards (WPCS)

### Indentation: tabs

WordPress uses tabs (not spaces) in PHP, JS, and CSS. Spaces are for inline alignment only.

### Spacing inside parens and brackets

The hallmark of WP code:

```php
// WordPress style
function my_function( $arg1, $arg2 ) {
    if ( $condition ) {
        $arr = array( 'one', 'two' );
        do_something( $arr[ $key ] );
    }
}

// NOT WordPress style (PSR-12 style)
function my_function($arg1, $arg2) {
    if ($condition) {
        $arr = ['one', 'two'];
        do_something($arr[$key]);
    }
}
```

Spaces: inside `()`, inside `[]` when accessing, around `=>` in arrays.

### Yoda conditions

```php
if ( 'publish' === $status ) { ... }  // Yoda — WordPress style
if ( $status === 'publish' ) { ... }  // Not Yoda
```

Reason: prevents accidental assignment (`=` instead of `==`). Always use strict comparison (`===`, `!==`) unless you specifically need type juggling.

### Arrays

Core uses long-form `array()`. Short-form `[]` is acceptable in modern code — match the codebase:

```php
$args = array(
    'post_type'      => 'book',
    'posts_per_page' => 10,
    'meta_query'     => array( ... ),
);
```

### Naming

| Type | Convention | Example |
|---|---|---|
| Functions | `snake_case` | `acme_get_books()` |
| Variables | `snake_case` | `$post_id` |
| Classes | `Capitalized_Snake_Case` | `Acme_Book_Repository` |
| Constants | `UPPER_SNAKE_CASE` | `ACME_VERSION` |
| Files | `kebab-case.php` | `class-acme-book-repository.php` |
| Hooks | `lower_snake_case` | `acme_before_save_book` |

In Roots projects, PSR-4 class naming (`PascalCase`, `PascalCase.php`) is standard and acceptable.

---

## The prefix-everything rule

WordPress is a shared global namespace. Everything you register needs a prefix tied to the plugin/theme slug:

```php
// Functions, classes, constants
function acme_send_email() {}
class Acme_Mailer {}
define( 'ACME_VERSION', '1.0.0' );

// Hooks
do_action( 'acme_before_send_email', $email );

// Options, post types, taxonomies, shortcodes
update_option( 'acme_settings', $data );
register_post_type( 'acme_book', ... );
add_shortcode( 'acme_button', ... );

// JS globals, CSS class names that are theme-extensible
window.acmeWidget = {};
echo '<div class="acme-book-card">';
```

In Roots projects, PHP namespaces replace function/class prefixes (`Acme\Books\Repository`) — but you still prefix hooks, options, post types, and JS globals.

---

## File structure

```php
<?php
/**
 * Book repository.
 *
 * @package Acme_Books
 * @since   1.0.0
 */

defined( 'ABSPATH' ) || exit;  // Security guard for files accessible via URL
```

Omit the closing `?>` tag in PHP-only files — trailing whitespace causes "Headers already sent" errors.

---

## Docblocks

```php
/**
 * Saves a book.
 *
 * @since 1.0.0
 *
 * @param int    $post_id  Post ID.
 * @param string $isbn     ISBN string.
 * @param bool   $force    Optional. Overwrite existing. Default false.
 * @return int|WP_Error Saved post ID on success, WP_Error on failure.
 */
function acme_save_book( int $post_id, string $isbn, bool $force = false ) { ... }
```

Hook docblocks immediately above the `do_action` / `apply_filters` call:

```php
/**
 * Fires before a book is saved.
 *
 * @since 1.0.0
 *
 * @param int    $post_id  Post ID.
 * @param string $isbn     ISBN.
 */
do_action( 'acme_before_save_book', $post_id, $isbn );
```

---

## JavaScript

WordPress projects use `@wordpress/eslint-plugin`. Key points:

- Tabs for indentation
- Single quotes for strings
- Spaces inside `{}` for objects: `{ foo: 'bar' }`
- Semicolons required
- ES modules with named imports

```js
import { __ } from '@wordpress/i18n';

const ALLOWED_BLOCKS = [ 'core/heading', 'core/paragraph' ];

function isPublishable( { status, hasErrors } ) {
    if ( hasErrors ) return false;
    return 'draft' === status || 'pending' === status;
}
```

---

## CSS

```css
.acme-book-card,
.acme-author-card {           /* One selector per line */
    display: flex;
    padding: 1rem;            /* Tabs for indentation */
    background-color: #fff;   /* Lowercase hex, shortened where possible */
    border-radius: 4px;       /* Semicolon after every declaration */
}
```

---

## Tooling

### PHPCS + WordPress Coding Standards

```bash
composer require --dev wp-coding-standards/wpcs squizlabs/php_codesniffer
composer require --dev phpcompatibility/phpcompatibility-wp
```

`phpcs.xml.dist` in the project root:

```xml
<?xml version="1.0"?>
<ruleset name="Acme">
    <file>.</file>
    <exclude-pattern>*/vendor/*</exclude-pattern>
    <exclude-pattern>*/node_modules/*</exclude-pattern>
    <exclude-pattern>*/build/*</exclude-pattern>
    <exclude-pattern>*/public/*</exclude-pattern>

    <arg value="sp"/>
    <arg name="colors"/>

    <rule ref="WordPress">
        <exclude name="Generic.Arrays.DisallowShortArraySyntax"/>
    </rule>

    <rule ref="WordPress.WP.I18n">
        <properties>
            <property name="text_domain" type="array" value="acme"/>
        </properties>
    </rule>

    <config name="minimum_supported_wp_version" value="6.4"/>
    <config name="testVersion" value="8.3-"/>
</ruleset>
```

```bash
./vendor/bin/phpcs src/           # Check
./vendor/bin/phpcbf src/          # Auto-fix
```

### JS + CSS via `@wordpress/scripts`

```bash
npm install --save-dev @wordpress/scripts
npx wp-scripts lint-js src/
npx wp-scripts lint-style src/
npx wp-scripts format src/
```

---

## What WPCS will flag

The most common violations — all real issues:

- `echo $var` without escaping → `echo esc_html( $var )`
- `$_POST['x']` without `wp_unslash()` and sanitization
- `$wpdb` query with interpolated variables
- Missing translator comment for `__()` with placeholders
- Comparisons without strict `===`
- `array[ $key ]` without spaces → `array[ $key ]`
- Unprefixed function/class names in procedural code

Suppress a specific rule only when justified, with a comment explaining why:

```php
echo $already_safe_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
```

---

## Modern PHP in a WordPress context

**WP 6.7+ officially requires PHP 7.4; Acorn v6 requires PHP 8.3.**

You can use:
- Typed parameters / return types: `function foo( string $name ): bool {}`
- Null coalescing: `$val = $arg ?? 'default'`
- Arrow functions: `fn ( $x ) => $x * 2`
- Named arguments (with caution — WP hook parameter names can change in core)
- Match expressions (PHP 8.0+)
- Constructor property promotion (PHP 8.0+)
- Enum (PHP 8.1+)
- Readonly properties (PHP 8.1+)
- Intersection types (PHP 8.1+)

**Don't** use syntax unsupported by the minimum PHP version you declare in your plugin header. `testVersion` in `phpcs.xml` enforces this via PHPCompatibility.
