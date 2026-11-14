# Gutenberg Block Development

Read this when building custom blocks for the Block Editor.

---

## Static vs dynamic blocks — choose first

| Static | Dynamic |
|---|---|
| Saves rendered HTML to `post_content` | Saves only attributes; PHP renders on every request |
| No PHP per page render | Can change markup without invalidating saved blocks |
| Changing `save()` later breaks existing instances | Better for evolving UIs |
| Good for presentational blocks (cards, callouts) | Good for data-driven blocks (latest posts, queries, CPT output) |

**Prefer dynamic** when you might redesign the markup later. Changing `save()` on a static block forces users to "Attempt block recovery" on every saved instance — a painful user experience.

---

## Toolchain

```bash
# Scaffold a new block plugin
npx @wordpress/create-block@latest acme-feature-card

# Or inside an existing plugin, scaffold just the block files
npx @wordpress/create-block@latest --no-plugin acme-feature-card
```

`package.json` scripts via `@wordpress/scripts`:

```json
{
  "scripts": {
    "build": "wp-scripts build",
    "start": "wp-scripts start",
    "format": "wp-scripts format",
    "lint:js": "wp-scripts lint-js",
    "lint:css": "wp-scripts lint-style"
  }
}
```

Build output goes to `/build/`. Your `block.json` references files there.

---

## `block.json` (the source of truth)

```json
{
    "$schema": "https://schemas.wp.org/trunk/block.json",
    "apiVersion": 3,
    "name": "acme/feature-card",
    "version": "1.0.0",
    "title": "Feature Card",
    "category": "design",
    "icon": "star-filled",
    "description": "A card highlighting a single feature.",
    "textdomain": "acme",
    "attributes": {
        "title":       { "type": "string",  "default": "" },
        "description": { "type": "string",  "default": "" },
        "linkUrl":     { "type": "string",  "default": "" }
    },
    "supports": {
        "html":    false,
        "anchor":  true,
        "align":   ["wide", "full"],
        "spacing": { "margin": true, "padding": true },
        "color":   { "background": true, "text": true }
    },
    "editorScript": "file:./index.js",
    "editorStyle":  "file:./index.css",
    "style":        "file:./style-index.css",
    "render":       "file:./render.php"
}
```

Key fields:
- `apiVersion: 3` — current as of WP 6.3+. Enables the iframed editor.
- `supports` — declare editor UI controls here; they're generated for you.
- `html: false` — strongly recommended; allowing HTML edit invites breakage.
- `render` — for dynamic blocks. Point to a PHP file.
- `textdomain` — must match your plugin/theme for string translation.

---

## Static block

`edit.js`:
```jsx
import { __ } from '@wordpress/i18n';
import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function Edit( { attributes, setAttributes } ) {
    return (
        <div { ...useBlockProps() }>
            <RichText
                tagName="h3"
                value={ attributes.title }
                onChange={ title => setAttributes( { title } ) }
                placeholder={ __( 'Feature title…', 'acme' ) }
            />
        </div>
    );
}
```

`save.js`:
```jsx
import { useBlockProps, RichText } from '@wordpress/block-editor';

export default function save( { attributes } ) {
    return (
        <div { ...useBlockProps.save() }>
            <RichText.Content tagName="h3" value={ attributes.title } />
        </div>
    );
}
```

`index.js`:
```jsx
import { registerBlockType } from '@wordpress/blocks';
import Edit from './edit';
import save from './save';
import metadata from './block.json';

registerBlockType( metadata.name, { edit: Edit, save } );
```

`useBlockProps` is essential — it merges the block's wrapper classes, inline styles, anchor, and all supports into the element. Without it, color, spacing, and alignment controls don't work.

---

## Dynamic block

Same `block.json` with `"render": "file:./render.php"`. `save` returns `null`:

```jsx
// index.js
registerBlockType( metadata.name, { edit: Edit, save: () => null } );
```

`render.php`:
```php
<?php
/**
 * @var array    $attributes Block attributes.
 * @var string   $content    Inner blocks rendered HTML.
 * @var WP_Block $block      Block instance.
 */

$wrapper = get_block_wrapper_attributes( [ 'class' => 'acme-feature-card' ] );
$title   = esc_html( $attributes['title'] ?? '' );
?>
<div <?php echo $wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
    <h3 class="acme-feature-card__title"><?php echo $title; ?></h3>
</div>
```

`get_block_wrapper_attributes()` is the PHP equivalent of `useBlockProps.save()` — it applies the user's color, spacing, and alignment choices to the wrapper. Always use it; never hardcode `class="..."` on the wrapper.

---

## Server-side registration

```php
add_action( 'init', static function () {
    // Single block:
    register_block_type( __DIR__ . '/build/feature-card' );

    // All blocks in /build/:
    foreach ( glob( __DIR__ . '/build/*/block.json' ) as $block_json ) {
        register_block_type( dirname( $block_json ) );
    }
} );
```

---

## InnerBlocks

```jsx
// edit.js
import { useBlockProps, InnerBlocks } from '@wordpress/block-editor';

const TEMPLATE = [
    [ 'core/heading', { level: 3, placeholder: 'Card title…' } ],
    [ 'core/paragraph', { placeholder: 'Description…' } ],
];

export default function Edit() {
    return (
        <div { ...useBlockProps() }>
            <InnerBlocks template={ TEMPLATE } allowedBlocks={ [ 'core/heading', 'core/paragraph' ] } />
        </div>
    );
}

// save.js
export default function save() {
    return <div { ...useBlockProps.save() }><InnerBlocks.Content /></div>;
}
```

In `render.php`, `$content` holds the rendered inner blocks — output it where needed.

---

## Inspector controls (sidebar panel)

```jsx
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, TextControl } from '@wordpress/components';

// Inside Edit:
<>
    <InspectorControls>
        <PanelBody title={ __( 'Settings', 'acme' ) }>
            <TextControl
                label={ __( 'Link URL', 'acme' ) }
                value={ attributes.linkUrl }
                onChange={ linkUrl => setAttributes( { linkUrl } ) }
                type="url"
            />
        </PanelBody>
    </InspectorControls>
    <div { ...useBlockProps() }>...</div>
</>
```

---

## Block styles and variations

```js
// Block style — alternate visual treatment
wp.blocks.registerBlockStyle( 'core/button', {
    name: 'outline-square',
    label: 'Outline Square',
} );
// CSS: .is-style-outline-square .wp-block-button__link { ... }

// Block variation — pre-configured instance
wp.blocks.registerBlockVariation( 'core/group', {
    name: 'acme/hero',
    title: 'Hero',
    attributes: { align: 'full', backgroundColor: 'primary' },
    scope: [ 'inserter' ],
} );
```

---

## Interactivity API (frontend interactions without React)

For accordions, tabs, filters, lightboxes:

`block.json`: `"viewScriptModule": "file:./view.js"`

`render.php`:
```php
<div
    <?php echo get_block_wrapper_attributes(); ?>
    data-wp-interactive="acme/accordion"
    data-wp-context='{"isOpen": false}'
>
    <button data-wp-on--click="actions.toggle">Toggle</button>
    <div data-wp-bind--hidden="!context.isOpen"><?php echo $content; ?></div>
</div>
```

`view.js`:
```js
import { store, getContext } from '@wordpress/interactivity';

store( 'acme/accordion', {
    actions: {
        toggle() { getContext().isOpen = ! getContext().isOpen; },
    },
} );
```

---

## Common pitfalls

- **Changing `save()` breaks existing blocks** — provide a `deprecated` migration array, or switch to dynamic.
- **`apiVersion: 3` enables iframed editor** — editor styles must be in `editorStyle`, not a global stylesheet.
- **No `useBlockProps` → supports don't work** — color, spacing, alignment controls have no effect.
- **Don't commit `/build`** unless your distribution requires it (wordpress.org plugin zips). Add a build step to your release process.

---

## Block development checklist

- [ ] `apiVersion: 3` in `block.json`
- [ ] `$schema` set
- [ ] `textdomain` matches plugin/theme
- [ ] `useBlockProps` in `edit` and `save` (or `get_block_wrapper_attributes` in `render.php`)
- [ ] Supports declared in `block.json`, not hand-built UI
- [ ] `html: false` unless you need the HTML edit mode
- [ ] All user-facing strings go through `__()` from `@wordpress/i18n`
- [ ] All dynamic output in `render.php` escaped appropriately
- [ ] No external HTTP calls in `render.php` without caching
