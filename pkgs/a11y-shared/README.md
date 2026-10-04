# @pkgs/a11y

Accessibility checks over a live DOM with no layout engine (happy-dom in
`bun test`, or a browser document): what a screen reader calls each element,
which elements the Tab key visits and in which order, which controls a screen
shows, and a set of W3C ACT rules. It knows nothing about the product; the
runtime's accessibility specs (`specs/runtime/accessibility.feature`) read
the app through it from `@libs/runtime`'s harness, and `@pkgs/ui`'s
`ScreenBase` uses its focus order to hand the keyboard from one screen to the
next.

| Module | What it does |
| --- | --- |
| `accessible-name` | `accessibleName(element)`: W3C AccName 1.2 § 4.3.2 steps 2A–2I — `aria-labelledby` (not followed twice; a hidden referenced node still names), embedded controls' values, `aria-label`, the HTML-AAM native sources (`<label>`, `alt`, input `value` / defaults, `<legend>`, `<caption>`, `<figcaption>`, SVG `<title>`), name from content (blocks are separate words), `title`, `placeholder`. CSS generated content is not read. |
| `roles` | `roleOf`: the explicit role (first valid token; `none` / `presentation` ignored on focusable or globally-ARIA'd elements) else the HTML-AAM implicit role; the role tables the rules use. |
| `visibility` | `isRendered` (`hidden`, never-rendered elements, inline or computed `display: none` / `visibility: hidden`), `isInert`, `isAriaHidden`, `isHiddenFromAt`. |
| `focus` | HTML § 6.6.3: `tabIndexOf`, `isFocusable`, `isSequentiallyFocusable`, `sequentialFocusOrder` (positive `tabindex` ascending, then tree order; disabled, inert and unrendered skipped; a radio group is one stop), `nextInFocusOrder` (Tab / Shift+Tab). |
| `controls` | `controlsIn(root)`: every control shown — native interactive elements, operable widget roles, `tabindex ≥ 0` — in reading order; `keyboardStops(root)`: the stops a keyboard should make (a composite's `tabindex="-1"` arrow-key members and a radio group's other radios excepted); `describeControl`: `role "name"`. |
| `audit` | `auditTree(root, rules?)` runs `ACT_RULES` over a subtree; `formatFailure` prints one. |

## ACT rules checked

| ACT id | Rule | WCAG 2.2 |
| --- | --- | --- |
| `97a4e1` | Button has non-empty accessible name | 4.1.2 |
| `c487ae` | Link has non-empty accessible name | 2.4.4, 2.4.9, 4.1.2 |
| `e086e5` | Form field has non-empty accessible name | 4.1.2 |
| `m6b1q3` | Menuitem has non-empty accessible name | 4.1.2 |
| `23a2a8` | Image has non-empty accessible name (decorative images are not applicable) | 1.1.1 |
| `2ee8b8` | Visible label is part of accessible name | 2.5.3 |
| `674b10` | Role attribute has valid value | 4.1.2 |
| `bc4a75` | ARIA required owned elements | 1.3.1 |
| `ff89c9` | ARIA required context role | 1.3.1 |
| `4e8ab6` | Element with role attribute has required states and properties | 4.1.2 |
| `6cfa84` | Element with `aria-hidden` has no content in sequential focus navigation | 1.3.1, 4.1.2 |

Keyboard operation (WCAG 2.1.1, 2.4.3, and no keyboard trap, 2.1.2 /
ACT `80af7b`) and focus moving into and back out of a screen are checked by
driving the app: the harness presses Tab and compares where focus lands with
`keyboardStops`.

Rules that need layout or color (contrast, target size, visible focus,
reflow) are out of reach without a rendering engine.

## Tests

`../a11y-harness/tests/accessible-name.test.ts` pins AccName and WPT `accname/` examples;
`../a11y-harness/tests/act-rules.test.ts` pins each rule on passed, failed and inapplicable
cases adapted from the ACT Rules test cases; the properties check the focus
order against a model of HTML's order built from a random page's description
(`focus-order.property.test.ts`) and the name's source precedence, hidden
content and normalization (`accessible-name.property.test.ts`).
