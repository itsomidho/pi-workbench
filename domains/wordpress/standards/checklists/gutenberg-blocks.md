# Gutenberg blocks checklist

- `block.json` is the source of truth: `apiVersion` 3 for new blocks, unique `name` with the plugin's namespace, `textdomain` set, `editorScript`/`style`/`viewScript` pointing to built files. Register with `register_block_type( __DIR__ . '/build/<block>' )` (the build dir, not `src`).
- **Static blocks:** changing the `save()` output or attribute definitions invalidates every existing instance ("This block contains unexpected or invalid content"). A change to `save()` needs a `deprecated` entry with the old `save` and attributes: 🔴 if missing on a block already used in content.
- **Dynamic blocks:** `render_callback` / `render.php` escapes everything it outputs (`security.md`), and `get_block_wrapper_attributes()` is used for the wrapper.
- Attributes: types and defaults defined; attributes sourced from HTML (`source: html/attribute`) must match the saved markup selector.
- Editor code imports from `@wordpress/*` packages (externals via `wp-scripts`), not bundled copies of React/ReactDOM. A third-party UI library in the editor bundle (e.g. Material UI) bloats every editor load; mention size impact.
- `useSelect` / `useEffect` dependency arrays complete; no data fetching on every render.
- `viewScript` runs on the front end for every page that has the block: keep it small; prefer the Interactivity API or plain JS.
- Built `build/` output is generated in the pipeline, not committed (check `.gitignore` / `infra.md`).
- Strings use `__()` from `@wordpress/i18n` with the block's text domain; JS translations loaded via `wp_set_script_translations()`.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/gutenberg-blocks.md`
