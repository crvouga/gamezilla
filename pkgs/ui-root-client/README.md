# @pkgs/ui-root-client

The design system: every component, type role, surface and color the product
paints. Screens compose it and arrange it; they never paint around it.

## The look: quiet, hairline, one blue

Clean and consistent in the manner of the big photo-social apps: a white or
true-black canvas, near-black text with one gray partner, hairline dividers,
generous whitespace, a strong type hierarchy, and one blue for what to do or
what is chosen. Nothing themed, nothing decorative, nothing that moves unless
a person asked.

| Token | Role |
| --- | --- |
| `background` | the canvas: white / true black |
| `surface` | one step off the canvas (#FAFAFA / #121212): wells, the wide backdrop, input fill |
| `surface-muted` | tags, segmented tracks, secondary buttons (#EFEFEF / #262626) |
| `surface-elevated` / `surface-overlay` | dialogs and sheets / menus, popovers, toasts |
| `text` / `text-secondary` | near-black or near-white, and its gray partner |
| `border` | the hairline (#DBDBDB / #333) on panels, cards, rows and bars |
| `outline` | control boundaries that must read at 3:1 |
| `tint-active` + `on-primary` | the blue fill with a white label, in both schemes |
| `tint` | blue as text: links, focus and selection |
| `destructive`, `success`, `warning`, `info` | status, each with a `*-surface` wash |

Values live in `design-system/design-tokens.json`. CSS variables, the
TypeScript token names and Swift are generated from it
(`bun run --filter @pkgs/ui-root-client tokens:generate`); light and dark are
one variable swap on `[data-theme]`, never two sets of classes.
`palette-contrast.test.ts` holds every text/fill pair to WCAG AA, which is
why the blue sits at the lightness where a white label still passes.

| Scale | Steps |
| --- | --- |
| Type | 12 / 14 / 16 / 20 / 24 / 32, leading on the 4px grid, weights 400 / 600 / 700, one system face |
| Space | the 4px grid only: `none xs sm md lg xl 2xl 3xl` = 0 4 8 12 16 24 32 48 |
| Radius | 4 (`sm`), 8 (`control`), 12 (`card`, `sheet`), `full` |
| Control height | 32 / 44 / 52 |
| Shadow | one: `shadow-float`, for what floats above content |
| Motion | 150 / 200 / 250ms, one ease-out curve; off under reduced motion |
| Breakpoints | sm 640, md 768, lg 1024, xl 1280 |

## Rules

1. **Blue means do or chosen.** `tint-active` fills only primary buttons,
   the FAB, selected chips, a checked switch, box or radio, and the current
   price. Never decoration. The active tab is full text color, not blue.
2. **Pick a role, never a size.** Text is `P` / `Text` with a `variant`
   (`body`, `bodyBold`, `label`, `caption`, `footnote`, `mono`) or `H1`–`H6`
   with a `size` (`title` 32, `heading` 24, `subtitle` 20,
   `navigationTitle` 16 bold, `label`). `numeral` for ratings, clocks, prices
   and counts. Nothing renders below 12px.
3. **One face.** The platform system stack carries everything. Mono is for
   code and identifiers, never for numbers or labels.
4. **Lists are panels.** Group rows in a `MenuSection` / `MenuList` (or
   `MainMenuScreen` for destinations): the canvas inside one hairline, the
   card radius, hairlines between rows inset to the text column. A row never
   paints its own radius or border. Never stack separate cards to make a list.
4a. **Nobody is an icon.** A person without a picture is the `Avatar`
   placeholder, never an outlined glyph in a ring. `icon` on an `Avatar` is
   for things that are not people: a bot, a game, a device.
5. **Radius encodes hierarchy.** `rounded-sm` marks and inline tags,
   `rounded-control` buttons, inputs and rows, `rounded-card` cards and
   panels, `rounded-sheet` dialogs and sheets. `rounded-full` only for round
   things: avatars, pills, the FAB, dots.
6. **Flat.** Hairlines separate, tone steps raise. The one shadow,
   `shadow-float`, is for menus, popovers, tooltips, toasts and the FAB.
   No gradients.
7. **Left-aligned.** Header titles sit after the back control and line up
   with the body. Only identity heroes and full-screen empty states center.
8. **Each fact is its own tag.** Metadata strips are rows of `Badge`s, never
   strings joined with `·`.
9. **Motion answers a person.** Hover and press fade in 150ms, a control
   changes state in 200ms, a surface enters in 250ms. Press is a tone shift
   and a 0.97 scale; nothing bounces. `prefers-reduced-motion` (and the app's
   reduced-motion setting) turns it all off.
10. **One activity indicator.** Every wait shows `Spinner` (twelve petals,
    stepping once a second): alone, in `LoadingState`, inside a loading
    `Button`, and on the boot screen in `index.html`.

## Composition

Atomic Design is the composition law, from [Brad Frost's
hierarchy](https://atomicdesign.bradfrost.com/chapter-2/). The modules stay
flat. `pkgs/` cannot grow `atoms/` or `molecules/` folders, and a page that
knows a route or a query stays in the feature that owns that fact.

| Level | What it is | Where it lives |
| --- | --- | --- |
| Atom | A role, an icon, a button, a field, a switch, the panel surface | this package |
| Molecule | A row, a chip, a clock, a choice, a menu row | this package |
| Organism | A menu section, a screen header, a game section, a dialog | this package |
| Template | The screen families below, built on `ScreenBase` / `EmbeddedScreen` | this package |
| Page | A feature screen that passes data into a template | `libs/*-client` |

Every page is one of two archetypes, and never both:

| Archetype | When | Top bar |
| --- | --- | --- |
| `ScreenBase` | A routed screen that owns the viewport: a tab, a settings page, a profile | Its own: back, title, actions |
| `EmbeddedScreen` | A screen shown inside a host's chrome: anything in a space | The host's. It never draws a second one |

`MainMenuScreen` (a menu of destinations) and `GameScreen` (a game) are
`EmbeddedScreen`s, so they share its width, edge padding and `ScreenIntro`
title block. A screen that needs a body title uses `ScreenIntro`; nothing
else draws an `h1`. Two bars stacked on one screen is always a bug: the inner
screen is the wrong archetype.

A page does not paint. It composes a template and hands it data. A second
type scale, a second card, or a one-off color is a missing atom, not a
screen decision.

### Screen families

Choose a family before assembling a page. Templates own measure, section
rhythm, scrolling, and placement of controls; features supply content and
callbacks. No template knows routes, permissions, queries, chess, or a game
protocol. Import each from its matching kebab-case module export.

| Template | Composition | Current consumers |
| --- | --- | --- |
| `MainMenuScreen` | Intro, one destination panel, helper and footer | Game chooser, game modes, embedded settings |
| `GameScreen` + `GameSessionLayout` | Intro, notices, setup, play stage, status, actions and optional record rail | Custom and matchmaking games |
| `GameSetupPanel` | Choices, primary commands, secondary options | Create a custom game, find an opponent |
| `PuzzleScreen` | Fixed feed / coaching, fitted board, legend, timeline, actions and overlay | Puzzle play |
| `GameHistoryScreen` | Summary, trend, statistics, filters and record list | Puzzle stats and attempts |
| `GameReviewScreen` | Review stage, timeline, actions and optional record rail | Puzzle review |
| `FormScreen` | Scrolling editor, shared Save / Cancel footer | Username and avatar editors |
| `MenuScreen` | Scrolling groups of `MenuSection` / `MenuList` | Settings, profile settings, account, devices, preferences |
| `ProfileScreenLayout` | Identity, identity actions, supporting sections | Own profile; `ProfileIdentity` also groups another person's identity |
| `CollectionScreen` | Fixed search / filters / notices, independently scrolling content | Spaces, friends, search, inbox |
| `ContentScreen` | Readable scrolling details, documents or state explanations | Privacy, billing, link outcomes, administration |

`ScreenColumn` gives routed reading bodies and form footers the same width
and section rhythm. It follows the header's left edge. Embedded templates
keep their reading or stage measure on the host header's left edge too. `GameLayout` stacks
the stage before the rail on phones and places the rail beside it on wide
screens; without a rail, the stage uses the full width. Toggling the rail
does not remount the play surface.

`ContentScreen` owns the scrolling body and measured footer once; `MenuScreen`,
`FormScreen` and `ProfileScreenLayout` compose it. Optional slots resolve Solid
children before deciding whether to allocate space: a false `<Show>`, empty
fragment, or `null` never reserves a rail, heading, divider, or footer. Zero
remains valid content. `createScreenSlot` supplies that shared contract.

`FormScreen` owns a native HTML form. Enter and the Save button use one mutation
controller, respect native field validity and the submit action's disabled state,
and prevent duplicate submissions during loading or success feedback. The footer
announces loading, success and error labels without removing them from the button.
Replacing submit or cancel props updates their labels, callbacks and availability.
Use `FormActionsFooter` for a standalone action row; a `FormScreen` already owns
its footer, so it never needs a second one in the body.

`CollectionScreen` puts fixed controls above a shrinking content region. Supply
search, filters and connection notices through `controls`; put the independently
scrolling list or state explanation in the body. Features never relay header
actions through effects just to reach the template.

`PuzzleScreen` reserves room for controls before fitting the board. Its
`boardAspectRatio` defaults to one, and accepts a finite positive width / height
ratio for rectangular boards. Invalid ratios throw rather than emitting invalid
CSS. The feature supplies the board, choices, commands, waiting state and
completion feedback. Setup, play and completed states use the same session
slots for every game mode; a game never defines a second screen scaffold.
Puzzle completion feedback, announcements and optional dialogs belong in its
`overlay` slot, inside the same screen boundary as the board and controls.

Explore **UI components → Screen Layouts** (`/ui`). Every family has a
registered example in `registry-entries-screens.ts`, using only this package.
Custom and matched examples include setup, play, completion and replay;
the matched example also exposes waiting and cancellation. The form example
shows native submission and failed-save recovery without leaving the editor,
and history opens a review.
Examples run inside a bounded viewport to exercise scrolling and pinned
chrome. Their composition contracts run in both themes and compact / wide
layouts in `../ui-root-harness/tests/screen-layout-contract.test.tsx`.
`screen-layout-regression.test.tsx`, `form-screen.test.tsx` and
`puzzle-screen.test.tsx` in that harness pin the empty-slot, native-submit,
reactive-prop and invalid-ratio regressions. These are DOM composition and
interaction checks; rendering both layout modes alone is not pixel geometry
or overflow evidence.

Patterns follow the open spec for that control: the HTML button, the
fieldset and radio group, the WAI-ARIA switch, checkbox, dialog and
disclosure, and CSS custom properties for every token. Contrast is WCAG 2.2
AA (`palette-contrast.test.ts`). Pointer targets stay at least 24px, and a
primary control is 44px. Color never carries a state alone: a chosen control
is also `aria-current`, `aria-pressed`, or a checked radio.

## Guard rails

`ProgressBar` is the one progress indicator: with a `label` it shows the
name, percentage and optional description. Pass a fraction from zero to one,
or omit `progress` while the amount of work is unknown. Announce completion only after the operation succeeds.

`AppRouterProvider` guards navigation and browser reloads while shared mutation
controls are loading. Mount `PendingNavigationConfirmation` inside the app's
localization and surface providers. Register other cancellable work with
`usePendingOperation`, and wrap embedded content changes with
`useConfirmNavigation` before unmounting their owner. Finishing the work clears
the warning and allows the requested departure.

The rules are enforced, so the easy path is the right one:

- The Tailwind theme (`src/theme.css`) is locked to these tokens: the stock
  palette, type scale, weights, leading, tracking, radii, shadows, easings,
  animations, measures and breakpoints are cleared, so `text-red-500`,
  `font-black`, `rounded-3xl`, `shadow-lg` and `2xl:` do not exist, and the
  shadcn lint (`no-unknown-classes`) rejects them.
- The monorepo's design-vocabulary lint (`libs/tools/scripts/design-vocabulary.ts`)
  fails every UI package that writes an arbitrary value (`w-[37px]`), a raw
  color (TS, TSX or CSS), a step off the 4px grid (`gap-1.5`) or `dark:`.
  Component packages also may not pick type or shadows.
- Product packages (`libs/*-client`, the apps, the feedback and harness
  consoles) may not write a DOM element or a `class` / `classList` / `style`
  attribute at all (`design-composition.ts`): a screen is a composition of
  these components, and a look it needs is a variant here.
- `palette-contrast.test.ts` fails a palette that drops below AA;
  `theme-artifacts.test.ts` fails a theme that drifts from the tokens; each
  app's `startup-shell.test.ts` fails a boot screen that is not the tokens and
  the activity indicator.

## A new screen

```tsx
<MenuScreen
  screenId="table-settings"
  breadcrumbs={[{ name: <Trans>Settings</Trans>, href: '/more' }, { name: <Trans>Table</Trans> }]}
>
  <MenuSection title={<Trans>Table</Trans>} footer={<Trans>Applies to every space you host.</Trans>}>
    <MenuRow leading={<ClockIcon size={24} color="icon" />} title={t`Clock`} value={t`5 min`} onClick={openClock} />
    <MenuRow title={t`Sounds`} trailing={<Switch value={on()} onValueChange={setOn} aria-label={t`Sounds`} />} />
  </MenuSection>
  <EmptyState variant="compact" title={t`No guests yet`} body={t`Share the space link to invite people.`} />
</MenuScreen>
```

`MenuScreen` gives the header, measure, section rhythm, insets and scrolling;
`MenuSection` gives the panel;
`EmptyState`, `Notice`, `Button` and `Badge` the rest. If a screen needs
something none of them express, add it here as a component, not as classes in
the screen. Editors choose `FormScreen` and supply `submit` / `cancel` actions;
the template places their feedback in the footer.
