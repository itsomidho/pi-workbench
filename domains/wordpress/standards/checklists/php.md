# PHP checklist

## Version floor and runtime

Find both numbers per component, never assume:
- **Declared floor:** `require.php` in that component's `composer.json`, or the `Requires PHP` header of the plugin (`style.css` for a theme).
- **Production runtime:** the project file (`projects/*.md`).

Severity for syntax newer than allowed:
- Newer than the **production runtime** → 🔴 Critical: fatal error in production.
- Newer than the **declared floor** but within the runtime → 🟡 Warning: it works in production but breaks the declared contract (local dev, CI, or another environment on the floor version). The fix is either to avoid the syntax or to raise the floor in `composer.json` and the header in the same MR.
- If the project file gives no runtime, treat the declared floor as the runtime.

If the header is lower than syntax the component already uses widely, the header is stale: don't flag the existing level, mention the mismatch in the summary instead.

Flag syntax newer than the floor:

| Introduced in | Syntax / API |
|---|---|
| 8.0 | named args, `match`, nullsafe `?->`, union types, constructor promotion, `mixed`, `static` return, `throw` expression, `str_contains`/`str_starts_with`/`str_ends_with` |
| 8.1 | enums, `readonly` properties, first-class callables `foo(...)`, `new` in initializers, pure intersection types, `never`, `array_is_list`, `final` class constants |
| 8.2 | `readonly` classes, DNF types `(A&B)\|null`, standalone `true`/`false`/`null` types, constants in traits |
| 8.3 | typed class constants, `#[\Override]`, `json_validate()`, dynamic class constant fetch `Foo::{$bar}` |
| 8.4 | property hooks, asymmetric visibility `private(set)`, `new Foo()->bar()` without parentheses, `array_find`/`array_any`/`array_all` |

Also check against the deployed runtime:
- 8.2+: dynamic property creation on classes without `#[\AllowDynamicProperties]` is deprecated (log noise, fatal in 9).
- 8.4+: implicit nullable params (`Foo $x = null`) are deprecated; should be `?Foo $x = null`.

## Correctness
- Type declarations on params, returns and properties where the codebase uses them; `declare(strict_types=1)` only if the file/codebase already does (adding it can turn WP's string-y values into `TypeError`s).
- Loose comparisons on user or meta values (`==`, `in_array` without `true`): `"0"`, `""`, `null` and `false` collide.
- `array` functions on values that may be `false`/`WP_Error`/`null` (e.g. `get_posts` is fine, `get_the_terms` may return `false` or `WP_Error`).
- Errors from external calls (REST feeds, DB writes, file I/O) handled, not silently ignored.
- Money/price comparisons: exact methods (`bccomp`, integer minor units, `DECIMAL` in SQL), not float math.

## Structure
- Namespaces match PSR-4 autoload paths in `composer.json`; no manual `require` for autoloadable classes. A new namespace or directory needs an autoload entry (and `composer dump-autoload` in the build).
- Global functions and constants outside a namespace are prefixed (collision with other plugins).
- Early returns over deep nesting; flag duplicated logic and dead code only when it's clearly introduced by this change.

**Deeper reference:** `$PI_CONFIG_DIR/domains/wordpress/skills/wordpress-guide/coding-standards.md`
