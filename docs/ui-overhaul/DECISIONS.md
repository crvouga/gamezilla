# UI overhaul decisions

Decisions made while running the overnight brief without anyone to ask. Each
entry says what the brief asked for, what I did, and why. **Review** marks the
ones that need your eye.

## Inputs

1. **Review: the reference mockups are missing.** The brief points to
   `design/custom-game/` (README, `Main`, `Play`, `Result`). That directory
   is not in this worktree, the main checkout, any local or remote branch, or
   `~/Downloads`. (`~/Downloads/{brand}-design-system-specs.zip` is an
   older component-contract spec, not these mockups.) I treated the brief's
   palette, type, space and radius tables, and its written description of
   Setup / Play / Game over, as the spec. The artboard comparison rounds in
   Phase 6 cannot run until the mockups are added.
2. **Branch.** The worktree was created on `feat/ui-overhaul-design-system`.
   I worked there (it is not `main`) and point a `ui-overhaul` branch at the
   final commit, so both names reach the same work. Nothing was pushed.

## Adapting the brief to the repository

3. **Review: tokens stay in `design-tokens.json`, not a new `.ts` file.** The
   repo already has one source of truth: the W3C Design Tokens (DTCG) JSON in
   `pkgs/ui-root-shared-ts/src/design-tokens.json`, read through typed
   readers, with a generator that writes `tokens.css` and `token-names.ts`
   and a `--check` mode run by `lint`. Moving the source to TypeScript would
   only reorder that pipeline. Instead I extended it: the generator now also
   writes a resolved `tokens.json` for other clients and design tools, and
   `token-names.ts` gains a `TextStyle` union. As the repo requires, all
   three outputs are gitignored and written by `bun install`. `tokens:verify`
   and the token tests fail when they drift.
4. **Review: color role names stay the repo's own.** Renaming every role to
   the brief's names would touch roughly 700 call sites and gain nothing
   visible. Each brief name maps to one existing role, and the brief's
   values are now those roles' values:

   | brief | role |
   | --- | --- |
   | surface | `background` |
   | surface-raised | `surface`, `surfaceElevated`, `surfaceOverlay` |
   | surface-sunken | `surfaceMuted` (also `boardCell`) |
   | line / line-strong | `border` / `outline` |
   | ink / ink-muted | `text` / `textSecondary` (and `icon`) |
   | primary / on-primary | `tintActive` / `onPrimary` |
   | primary-strong | `primaryStrong` (new) |
   | primary-ink | `tint` |
   | primary-soft / on-primary-soft | `tintSubtle` / `onPrimarySoft` (new) |
   | focus | `focusRing` |
   | success / danger | `success` / `destructive` (`destructiveActive` for fills) |
   | live | `live` + `onLive` (new) |
   | scrim | `scrim` |
   | player-1…8 | `player1`…`player8` (new) |
   | board-* | `boardLight`, `boardDark`, `boardHighlight`, `boardCell`, `boardCardFace`, `boardCardInk`, `boardCardInkRed` (new) |

5. **The text roles keep their names and take the brief's eight styles.**
   The eight styles are DTCG `typography` tokens, and each existing role
   now wears one of them. `title` is display (26/30, Unbounded); `heading`
   and `subtitle` are title (18/24 700); `navigationTitle`, `label` and
   `bodyBold` are body-strong; `caption` and `footnote` are caption
   (13/18 500, muted). The missing styles are new roles: `displayXl` for
   heading sizes, `stat` for headings and text, and `sectionLabel` for the
   `label` style above a group. `numeral` now sets Unbounded 600. The old
   role names appear in about 150 files, so renaming them was not worth it.
6. **Review: the light palette was tuned.** In light, `danger` text is
   `#c81e1e`, not `#dc2626`, because `#dc2626` falls below 4.5:1 on the
   sunken surface. `#dc2626` remains the danger fill under white. `warning`
   is `#a14a07`.
7. **The player colors were tuned so each pair differs in lightness.** Every
   two seat colors sit at least 4.5 apart in CIELAB lightness (L\*) in both
   themes, and each meets 3:1 against the canvas, raised paper and an empty
   board cell (`palette-contrast.test.ts`). Dark starts from the brief's
   hues. Light uses darker versions of the same hues, spaced from L\* 20
   to 58.
8. **Focus ring against the primary fill.** The ring is offset 2px from the
   control, so it is drawn on the surface around the control, never on the
   fill. Its 3:1 check is against every surface, not against `primary`.
9. **Fonts are self-hosted with `@fontsource/manrope` and
   `@fontsource/unbounded`.** Their CSS uses `font-display: swap` and
   `unicode-range` subsets. These are the only new dependencies.
10. **The leading follows the brief, not the 4px grid.** The brief's
    leadings are 22, 18, 30 and 44px. The old test required every leading to
    be a multiple of 4; it now checks the brief's exact values.

## Policies the brief conflicts with

11. **Review: no Toast.** `pkgs/ui-root-client-ts/README.md` rule 11 and
    `tests/no-toast.test.ts` ban toasts: an outcome is shown where the action
    happened. The brief lists Toast as a minimum component. I kept the ban
    because removing an enforced product policy is your call. Unbanning it
    means deleting that test and rule 11.
12. **Review: Spinner vs skeletons.** The repo's rule 10 is one activity
    indicator (`Spinner`). The brief wants skeletons, not spinners, for
    loading screens. `Skeleton` already exists.
13. **Storybook becomes the existing `/ui` explorer.** Every component
    already has an `*.example.tsx` registered in the explorer at `/ui`, with
    both themes and harness tests. Adding Storybook would duplicate that
    catalog, add a second toolchain, and break the rule that Turborepo is
    the only task runner. The explorer stays the catalog.
14. **ESLint and Stylelint become the existing guardrails.** The repo lints
    with Biome (with GritQL plugins), oxlint, `design-vocabulary.ts` and
    `design-composition.ts`. Those already ban hex literals, arbitrary values
    and markup in product packages. New rules go there, not into a second
    linter.
15. **Doc file names.** The repo requires `SCREAMING_SNAKE_CASE.md`, so the
    brief's `audit.md`, `design-system.md` and `REPORT.md` are written as
    `AUDIT.md`, `DESIGN_SYSTEM.md` and `REPORT.md`.

## Phase 3: the shared game frame

16. **The design system brings no words to the frame.** A player's out /
    reconnecting state is `{ kind, label }`, not a bare `'out' |
    'reconnecting'`, and the watcher count, standings, option messages and
    watching footer take every word from the caller. Fixed tags such as
    `LiveBadge` stay as they are; new game parts add no catalog messages.
17. **`GameStatus` became `GameTurnPill`, and its `active` tone became
    `emphasis="yours"`.** The viewer's turn is the soft blue fill, so a tone
    for it would say the same thing twice. `tone` keeps `neutral`,
    `success` and `warning` as a small mark beside the words.
18. **Ordinals are English-only until another locale ships.** The app's one
    locale is `en`. `formatOrdinal` takes the locale's
    `Intl.PluralRules` ordinal category and knows the English words; any
    other language falls back to the plain number, and a caller with
    localized words passes `ordinal` itself.
19. **Setup: the player count is shown, not changed, for now.** Light
    Cycles and Word Tiles seat two to four, each count its own registered
    mode (`frame.players.modes`). Changing the count from the setup screen
    would cancel the custom game, switch the space's selected game to the
    sibling mode (the screen is mounted per game id) and create a new
    custom game there: three operations, a navigation, and the space
    following the host, with no single operation that does it atomically.
    That is too invasive to do safely in the frame commit, so the setup
    shows the count read-only (`custom-game-players`) and each count stays
    its own entry in the game menu. A host-only stepper that does the switch
    is deferred.
20. **Setup: every option is the frame's control, applied at once.** A
    game's `frame.options` replace its own setup form
    (`presentation.Configuration` is gone). A choice is chips and a count
    is a stepper; each change is applied immediately through the existing
    `rules` choice, the stepper shows the chosen value while it is applied
    and sends later steps after it, last one last. A count offers only its
    range, so a value outside it cannot be entered, and the range line
    under it ("Choose from 1 to 9.") says why. Controls are
    `custom-game-option-${id}` (chips `-${value}`; stepper `-decrease`,
    `-increase`, `-value`, range `-range`). Someone who may not set the
    game up reads the same options as text.
21. **Setup: the viewer's role comes from decisions and seats only.** Host
    is `canConfigure`; seated is holding a seat (`mySide`) without it;
    member may `canJoin` and an open seat exists; anyone else watches. No
    role name, `isAnon` or tier is read. A seated non-host sees "You ·
    guest" on their seat and "Waiting for the host to start."; a member
    sees "Sit here" on each open seat and "Take a seat" (the first open
    seat, the same `claim` choice); with every seat taken a non-seated
    person is told "All seats are taken. You'll watch.".
22. **Review: Play: a watcher still sees the first side nearest.** The
    brief shows the person's own strip only when they are seated. But
    `specs/games/custom-game-sides.feature` says "A watcher sees the first
    side nearest" (and "A creator watching two bots sees the first side
    nearest"), and specs are read-only. So the seat below the board is the
    viewer's own when they sit, and otherwise the first side, the side
    the board is drawn from (`frameTable` in `game-frame-table.ts`). The
    remaining seats go above the board: one is a strip, two or more are the
    rail. A watcher also gets the "You're watching" footer.
23. **Mock / seam: the watcher count is read from the space.** Nothing
    records who has a custom game open. `game-frame-watchers.ts` counts the
    people connected to the space right now (`useConnectedSpaceRoster`,
    one per person) minus the people seated at the game. Someone in the
    space looking at another screen still counts. When games record their
    own watchers, replace the body of `useFrameWatcherCount`.
24. **Mock / seam: rematch readiness for custom games.** Custom games store
    no per-player rematch readiness: the host starts the rematch and every
    seat is kept. `game-frame-rematch-readiness.ts`
    (`customGameRematchReadiness`) returns no readiness for every
    standings row and one note, "Host starts the rematch", shown under the
    headline. Real readiness needs a data-model change (deferred); only
    that function's body changes when it lands.
25. **Game over: "Change game" is the existing New game.** The brief's
    player actions are Rematch / Change game / Review, reusing the existing
    operations. "Change game" is the `create` choice (`custom-game-new`). It
    opens a fresh setup where the options and seats are chosen again.
    Rematch (`custom-game-rematch`) is the primary step. Both stay the
    host's (`canCreate`), as before. Review (`custom-game-review-start`)
    steps back to the first position. A watcher gets Back to the space
    (`custom-game-back`, the space's existing back) and Review.
26. **Play: a game's turn line replaces only "<Side> to move."** Where
    `frame.turnStatus` returns a line (Battleship, Hearts), it stands in for
    the default `<Side> to move.`. Every other line of the pill keeps the
    platform's lifecycle copy ("Ready to start.", the secret-choice count,
    "played by a stand-in bot", every ending such as "Black wins by
    resignation."), so journeys and steps read the same words. The pill
    keeps `custom-game-status`, `role=status`, `aria-live=polite` and the
    hidden lineup. During setup it stays in the status row. Once the game
    is played it sits between the board and the near seat.
27. **Play: chips gained `tags`.** Hearts' harness reads
    `custom-game-${side}-committed` / `-stand-in` badges at a four-seat
    table, so `GamePlayerChip` takes a `tags` slot like the strip does (the
    game's `seats.facts`, Chosen, Stand-in bot). A chip's figure is the
    game's `seats.stat`, or the running clock in a timed game.
