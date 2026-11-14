# Theme checklist (applies to classic, block, and Sage themes)

- Presentation only: data models, CPTs, taxonomies, REST endpoints and business logic belong in a plugin. A CPT registered in the theme disappears when the theme changes. Flag new ones as a warning unless the project already does this deliberately.
- Template hierarchy: a new template file has the name WordPress actually looks up (`single-{post_type}.php`, `taxonomy-{tax}-{term}.php`, or the Blade equivalent under `resources/views/`).
- Theme supports (`add_theme_support`), menus, sidebars and image sizes registered on `after_setup_theme`. A new image size only applies to new uploads; flag if the change relies on it for existing images without a regeneration note.
- Images output with `wp_get_attachment_image()` (srcset, lazy loading, alt) rather than hand-built `<img>` tags.
- `theme.json`: changes to palette/typography/spacing presets ripple across the editor and front end; check that removed or renamed presets aren't still referenced in templates or blocks.
- Accessibility basics on changed markup: real buttons/links, `alt` text, labels on form fields, visible focus states, heading order.
- RTL: when the site is RTL, layout changes must work mirrored (see `css-scss.md`).
- Child-theme or parent hooks: overriding a template copies it; flag when a parent template is copied wholesale for a small change that a hook/filter could do.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/theme-development.md`
