# Design system

The one source of truth for how the product looks. Edit it here, in this
repository, and nowhere else: the Gamezilla design-system artifact on
claude.ai is a published view of this folder and the component library,
republished by `bun run design:sync` (see [`CLAUDE.md`](../CLAUDE.md#changing-the-design-system)).

| File | What it holds |
| --- | --- |
| [`tokens.json`](tokens.json) | Every color, type style, space, radius, size, motion and layer value (W3C Design Tokens). `bun run tokens:generate` projects it into CSS variables and TypeScript token names; nothing else may hold a value. |
| `README.md` | The brand rules below. |
| [`spaces.md`](spaces.md) | The Spaces UX rules and the phase-by-role table for host and guest screens. |

The components that implement these rules are `@pkgs/ui`
([`pkgs/ui-root-client-ts`](../pkgs/ui-root-client-ts/README.md)); every
component has stories in Storybook (`bun run design:story`).

## The look: calm chrome, one accent, expressive games

Application chrome is quiet slate in both schemes: ink-blue charcoal and soft
paper surfaces with cool gray inks, so long sessions are easy on the eyes.
One indigo accent marks what a person can act on or has chosen: links, the
primary fill, selection and focus rings. Feedback keeps its words and icons
and adds its named hue (red, green, amber, blue); it never depends on hue
alone. Manrope sets every line of copy, headlines and numbers (tabular
figures).

Game-prefixed color tokens belong only to playing surfaces. Component-local
variables scope them to the board, leaving the surrounding chrome neutral.
Chess keeps its cream and walnut squares; Connect Four uses a cobalt frame
and red/gold discs; Battleship has naval waters; Quoridor uses sand and timber;
Hearts uses green felt and paper cards; Word Tiles uses a garden-green tray
with cream letters and labeled bonus squares; Sokoban uses slate masonry and
gold cargo; Numberlink uses ivory in light mode and plum slate in dark mode; Pong uses a violet court;
Light Cycles uses a dark cyan arena with patterned bright trails.

Values live in [`tokens.json`](tokens.json). CSS
variables, TypeScript token names and a resolved `tokens.json` are generated
from it (`bun run tokens:generate`).
Dark is the `:root` default; light is one variable swap on
`[data-theme="light"]` (and `prefers-color-scheme: light` before a theme is
set), never two sets of classes. `palette-contrast.test.ts` (`pkgs/ui-root-shared-ts/tests`) holds every
text/fill pair to WCAG AA (3:1 for large text, meaningful borders, focus
rings, icons and seat colors) and keeps the seat colors apart in lightness.

| Scale | Steps |
| --- | --- |
| Type | eight styles: `display-xl` 40/44, `display` 26/30, `stat` 20/24 (numbers), `title` 18/24, `body` 15/22, `body-strong` 15/22, `caption` 13/18, `label` 12/16 |
| Face | Manrope 400 / 500 / 600 / 700 for copy, headlines and numbers (tabular figures); self-hosted, `font-display: swap` |
| Space | the 4px grid only: `none xs sm md lg xl 2xl 3xl` = 0 4 8 12 16 24 32 48; phone gutter 16 |
| Radius | 6 (`sm`: small details), 12 (`control`, `card`: inputs, rows, cards, lists), 20 (`sheet`: sheets, dialogs, boards), `full` (buttons, chips, tags, header tabs, avatars, stat pills) |
| Control height | 32 / 44 / 52; every control keeps a 44px hit area |
| Shadow | one: `shadow-float`, for what floats above content |
| Motion | 150 / 200 / 250ms, one ease-out curve, only in answer to a tap; off under reduced motion |
| Breakpoints | sm 640, md 768, lg 1024, xl 1280 |

## Rules

1. **Calm chrome, one accent.** Neutrals are slate and never carry a hue of
   their own. The indigo accent is the primary fill (`tint-active`), links
   (`tint`), selection (`tint-subtle` and `on-primary-soft`) and focus; it is
   never decoration. Status takes its named hue and is always named or
   accompanied by an icon. Richer color belongs to playing surfaces, seat
   colors, the product mark and vendor-mandated identity artwork
   (`palette-contrast.test.ts` holds neutrals quiet and the accent to one
   hue).
2. **Pick a role, never a size.** Text is `P` / `Text` with a `variant`
   (`body`, `rowTitle`, `bodyBold`, `label`, `caption`, `footnote`,
   `sectionLabel`, `stat`, `mono`) or `H1`–`H6` with a `size` (`displayXl`,
   `title`, `heading`, `subtitle`, `navigationTitle`, `label`, `stat`).
   `rowTitle` is the title of a row or card a screen lays out itself (body at
   medium weight, as `MenuRow` sets its own), so the thing never weighs less
   than the action beside it. Each role wears
   one of the eight text styles; the mapping is in `pkgs/ui-root-client-ts/src/hosts.css` and
   `docs/ui-overhaul/DECISIONS.md`. `numeral` (Manrope 600, tabular) for
   ratings, clocks, prices and counts; counts from 1,000 are compact
   (`formatCompactNumber`: 12.4K). Nothing renders below 12px.
3. **One face.** Manrope carries every headline, label, button, line of copy
   and number (tabular figures). Mono is for code and
   identifiers, never for numbers or labels. Google sign-in alone uses its
   mandated, self-hosted Google Sans Medium.
4. **Lists are panels.** Group rows in a `MenuSection` / `MenuList` (or
   `MainMenuScreen` for destinations): paper (`surface`) inside one hairline,
   the card radius, hairlines between rows inset to the text column. A row never
   paints its own radius or border. Never stack separate cards to make a list.
4a. **Nobody is an icon.** A person without a picture is the `Avatar`
   placeholder, never an outlined glyph in a ring. `icon` on an `Avatar` is
   for things that are not people: a bot, a game, a device.
5. **Radius encodes hierarchy.** `rounded-full` chips, tags and header tabs,
   `rounded-control` inputs and rows, `rounded-card` cards and panels,
   `rounded-sheet` dialogs, sheets and boards. `rounded-full` for buttons and
   round things: avatars, stat pills, the FAB, dots.
6. **Flat.** Hairlines separate, tone steps raise. The one shadow,
   `shadow-float`, is for what floats: sheets, dialogs, menus, popovers,
   tooltips and the FAB. No gradients, no glows.
7. **One navigation surface.** Wide layouts navigate from the sidebar
   (`AppHeaderIsland orientation="vertical"` in `AppFrame` `rail`): logo,
   one row per destination, the global chrome at its foot. Screens beside it
   draw their own breadcrumb header, so every subpage keeps one semantic,
   focusable heading. A screen that draws its own chrome (an open space)
   draws it at the top of its column, beside the sidebar, which stays. Compact screens keep
   their title/back bar and the tab bar. Standalone screens retain their own
   headers.
   **Left-aligned.** Header titles sit after the back control and line up
   with the body. Only identity heroes and full-screen empty states center.
8. **Each fact is its own tag.** Metadata strips are rows of `Badge`s, never
   strings joined with `·`. Every tag is one shape, one type size and
   sentence case; only the tone changes: a status is the `subtle` wash
   (`Live`, `Current`, `Friends`, `Host`), a count the `solid` fill.
9. **Motion answers a person.** Hover and press fade in 150ms, a control
   changes state in 200ms, a surface enters in 250ms. Press is a tone shift
   and a 0.97 scale; nothing bounces. `prefers-reduced-motion` (and the app's
   reduced-motion setting) turns it all off.
10. **One activity indicator.** Every wait shows `Spinner` (twelve petals,
    stepping once a second): alone, in `LoadingState`, inside a loading
    `Button`, and on the boot screen in `index.html`.
11. **Outcomes are told in context, never in a toast or a top banner.** What
    became of an action shows where the action lives: the control's own
    feedback face (`useMutationButton`, `MutationModal`, `FormActionsFooter`)
    or an inline `Notice` beside the thing it is about (`onDismiss` makes it
    dismissible). There is no toast, snackbar or top banner for the outcome
    of an action, and none comes back: `tests/no-toast.test.ts` fails when a
    toast or snackbar module, export or import appears in this package.
