# CSS / SCSS / Tailwind checklist

## RTL
- On RTL sites, prefer logical properties: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-start-start-radius`, `text-align: start`. Physical `left`/`right` breaks the mirrored layout unless the codebase has an RTL build step (RTLCSS / `rtl.css`) that flips them.
- Tailwind: logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) or `rtl:` / `ltr:` variants instead of `ml-*`/`mr-*`/`left-*` on direction-sensitive layout.
- Icons that imply direction (arrows, chevrons, "next") are mirrored in RTL.
- Transforms with `translateX` and animations moving horizontally reversed for RTL where they imply direction.

## Design tokens
- Colors, spacing, font sizes and breakpoints come from Tailwind config / `theme.json` presets / SCSS variables where those exist; flag new hardcoded hex values or magic numbers that duplicate an existing token.
- New Tailwind classes built dynamically (string concatenation like `` `text-${color}` ``) are purged in production: use full class names or a safelist.

## Correctness
- Selectors scoped to the component; no global overrides of `body`, element selectors, or WordPress core/admin classes that leak beyond the change.
- `!important` only when overriding third-party CSS that can't be beaten by specificity; flag new ones otherwise.
- `z-index` values fit the existing scale (header, modals, admin bar at 99999).
- Equal `z-index` values in the same stacking context are decided by DOM order, which JS (toasts, modals moved to `<body>`) can change. Don't reuse the max value (`z-[9999999999]` / 2147483647) for new layers; pick a value from the scale with a clear gap above and below what it must cover or stay under. (added 2026-10-06)
- Responsive: changed layouts checked at mobile widths; no fixed widths that cause horizontal scroll.

## Performance and accessibility
- Web fonts: `font-display: swap`; Persian fonts subset or WOFF2; no duplicate font loads.
- No large inlined images (`data:` URIs) in CSS bundles.
- Focus styles not removed (`outline: none` without a replacement); color contrast reasonable for text changes.
- `prefers-reduced-motion` respected for new animations.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/theme-development.md`
