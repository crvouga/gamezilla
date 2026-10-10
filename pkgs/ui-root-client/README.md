# @pkgs/ui-root-client

The design system: every component, type role, surface and color the product
paints. Screens compose it and arrange it; they never paint around it.

## The look: neutral and blue

The proven look of the big social apps: white and true black, gray text
tiers, and one blue for what to do or what is chosen. Nothing themed,
nothing decorative.

| Token | Role |
| --- | --- |
| `background` | the canvas: white / true black |
| `surface` | panels and cards, one step off the canvas |
| `surface-muted` | inputs, tags, segmented tracks, coach bubbles |
| `text` / `text-secondary` | near-black or near-white, and its gray partner |
| `tint-active` + `on-primary` | the blue fill with a white label, in both schemes |
| `tint` | blue as text, links, focus and selection |
| `destructive`, `success`, `warning`, `info` | status, each with a `*-surface` wash |

Values live in `@pkgs/ui-root-shared/color-palette`; `tokens.css` is generated
from it (`bun run --filter @pkgs/ui-root-client tokens:generate`).
`palette-contrast.test.ts` holds every text/fill pair to WCAG AA, so a retune
that loses contrast fails.

## Rules

1. **Blue means do or chosen.** `tint-active` fills only primary buttons,
   the FAB, selected chips, a checked switch or box, and the current price.
   Never decoration. On the blue fill the label is `on-primary`. The active
   tab is full text color, not blue.
2. **Pick a role, never a size.** Text is `text` plus one role:
   `textTitle` (36), `textHeading` (24), `textSubtitle` (21),
   `textNavigationTitle` (18), `textLabel` (16, display face), `textBody` /
   `textBodyBold` (16), `textCaption` (14, secondary), `textFootnote` (12,
   secondary), `textMono` (code only). Add `textNumeral` to ratings, clocks,
   prices and counts. Nothing renders below 12px.
3. **Two faces, two jobs.** Bricolage Grotesque (display) carries titles,
   row titles, buttons and numbers. The platform face carries body copy. Mono
   is for code and identifiers, never for numbers or labels.
4. **Lists are panels.** Group rows in a `MenuSection` / `MenuList` (or
   `MainMenuScreen` for destinations): one `surface` panel, the panel radius,
   hairlines inset to the text column. A row never paints its own radius or
   border. Never stack separate cards to make a list.
5. **Radius encodes hierarchy.** `rounded-sm` marks and inline chips,
   `rounded-control` (12) buttons, inputs and rows, `rounded-card` (20)
   panels, `rounded-sheet` (28) sheets and dialogs. `rounded-full` only for
   round things: avatars, pills, tags, the FAB, dots.
6. **No shadows, no gradients.** Surfaces step up in tone instead. That is
   also what a low-end phone can paint at 60fps.
7. **Left-aligned.** Header titles sit after the back control and line up
   with the body. Only identity heroes (the profile avatar) and full-screen
   empty states center.
8. **Each fact is its own tag.** Metadata strips are rows of `textFootnote`
   pills on `surface-muted`, never strings joined with `·`.
9. **Motion answers a person.** Press is a tone shift and a 0.97 scale.
   Nothing bounces, and `prefers-reduced-motion` turns transitions off.

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
| Template | `ScreenBase`, `GameScreen`, `MainMenuScreen` | this package |
| Page | A feature screen that passes data into a template | `libs/*-client` |

A page does not paint. It composes a template and hands it data. A second
type scale, a second card, or a one-off color is a missing atom, not a
screen decision.

Patterns follow the open spec for that control: the HTML button, the
fieldset and radio group, the WAI-ARIA switch, checkbox, dialog and
disclosure, and CSS custom properties for every token. Contrast is WCAG 2.2
AA (`palette-contrast.test.ts`). Pointer targets stay at least 24px, and a
primary control is 48px. Color never carries a state alone: a chosen control
is also `aria-current`, `aria-pressed`, or a checked radio.

## Guard rails

The rules are enforced, so the easy path is the right one:

- The Tailwind theme (`codemod/theme.css`) is locked to these tokens. Stock
  colors (`text-red-500`), sizes, radii and shadows do not exist, and the
  shadcn lint (`no-unknown-classes`) rejects them.
- The monorepo's design-vocabulary lint fails any product client package
  that writes a font size, weight, leading, tracking, `uppercase`, shadow,
  arbitrary value (`w-[37px]`) or raw color. Layout utilities (`flex-row`,
  `gap-3`, `p-4`) stay free.
- `palette-contrast.test.ts` fails a palette that drops below AA.

## A new screen

```tsx
<ScreenBase
  screenId="table-settings"
  breadcrumbs={[{ name: <Trans>Settings</Trans>, href: '/more' }, { name: <Trans>Table</Trans> }]}
  scroll
  content={() => (
    <div class="box gap-6">
      <MenuSection title={<Trans>Table</Trans>} footer={<Trans>Applies to every space you host.</Trans>}>
        <MenuRow leading={<ClockIcon size={20} color="icon" />} title={t`Clock`} value={t`5 min`} onClick={openClock} />
        <MenuRow title={t`Sounds`} trailing={<Switch value={on()} onValueChange={setOn} aria-label={t`Sounds`} />} />
      </MenuSection>
      <EmptyState variant="compact" title={t`No guests yet`} body={t`Share the space link to invite people.`} />
    </div>
  )}
  footer={<FormActionsFooter … />}
/>
```

`ScreenBase` gives the header, insets and scrolling; `MenuSection` the panel;
`EmptyState`, `Notice`, `Button` and `Badge` the rest. If a screen needs
something none of them express, add it here as a component, not as classes in
the screen.
