# Game UI

Every game is shown in one shared frame with three phases: **Setup** (who
sits where, the options), **Play** (the board and the people around it) and
**Game over** (how it ended, who placed where, what next). The frame's
building blocks live here. Import each through
`@pkgs/ui-root-client-ts/<module>`.

These components take words, content and callbacks. The caller owns rules,
permissions, state, persistence, navigation and every word on screen. No
module names a game, a route or a permission. Explore them in `/ui`:
**Screen Layouts → Game frame** for the whole flow, and **Games → Game
frame: Setup / Play / Game over** for each part in both themes.

| Phase | Modules | Purpose |
| --- | --- | --- |
| Frame | `game-screen`, `game-session-layout` | The game inside its host's chrome: title row, notices, setup, stage, actions, rail and footer |
| Setup | `game-player-bar`, `game-seat-swatch`, `game-option-field` | The seat list and the game's options |
| Play | `game-board-stage`, `game-player-rail`, `game-turn-pill`, `game-action-bar`, `game-watching` | The board, the other players, whose turn, what to do, who is watching |
| Game over | `game-result` | The headline, the standings and a solo run's numbers |
| Shared | `game-clock`, `game-stat`, `game-action-button`, `game-section`, `game-choice-grid`, `game-disclosure`, `game-countdown`, `game-search-state` | Time, numbers, inline asynchronous commands, grouped content and matchmaking states |

## The frame

`GameScreen` is an `EmbeddedScreen`: the host (a space) owns the one top
bar, so a game never draws a second one. It requires a `screenId` and a
`title`, shown once in the body.

`GameSessionLayout` arranges one game in reading order: `header`, `notices`,
`setup`, the stage (`children`, `status`, `actions`), the optional `aside`
rail, and `footer`. `header` is a `GameSessionHeader`: a `title` and a
`trailing` edge for the watcher count and a "Change game" button. `footer`
is the `GameWatchingFooter` for someone who is watching. Every slot resolves
its content first (`createScreenSlot`, see the package README): a false
`<Show>`, `null` or an empty fragment draws nothing and takes no room.
`GameLayout` stacks the stage before the rail on phones and puts the rail
beside it on wide screens.

## Setup

Each seat is a `GamePlayerBar`: avatar, swatch, name, a row of `Badge`
facts (side, rating, readiness) and the seat's controls in `children` (an
open seat's "Sit here" is the one blue fill). The avatar says who holds the
seat: `Avatar` `person`, `bot`, `guest` or `emptySeat`, never an outlined
glyph. A table has one to eight seats, each with its own look.

`GameSeatSwatch` draws a seat's look: a round dot in its player color
(`player1`..`player8`, at least 4.5 L\* apart, so seats never rely on hue)
and / or a short mark glyph (`●`, `◆`, `X`). It is decorative beside a name;
with a `label` it is an image with that name.

`GameOptionField` is one setting. `kind: 'choice'` is a single-select
`ChipGroup`; `kind: 'count'` is a `NumberStepper` with an optional `message`
under it (`hint` for the range, `error` for why a value is not allowed),
which also describes the stepper. `readOnly` is for someone who may see the
settings but not change them: the name and the chosen value as text, no
control. `testId` is shipped on the control (the stepper derives
`-decrease`, `-increase` and `-value`).

## Play

The board is the largest thing on a game screen. `GameBoardStage` places,
top to bottom: `others`, the board (`children`), `turn` and `own`.

- **One opponent:** `others` is their `GamePlayerBar`.
- **Three or more players:** `others` is a `GamePlayerRail` of
  `GamePlayerChip`s: avatar, swatch, name (truncated), figure and state in a
  compact chip. The rail scrolls horizontally inside its own box, so seven
  long names never widen a 360px page.
- **Solo:** no `others`, no `own`; the board and the turn.

A strip or chip takes the same seat facts: `swatch`, `tags` (short facts,
each a `Badge`), `stat` (one figure,
`{ label, value }`, in the `stat` text style at the far edge), `state`
(`{ kind: 'out' | 'reconnecting', label }`: a word in a tag, and an out
seat is dimmed) and `active` (the seat to move: the soft blue `tintSubtle`,
a `primaryStrong` border on a chip, and `aria-current="step"`). With
`onPress` the identity becomes a real button, named by the player, to open
them. A strip's `trailing` holds its `GameClock`.

`GameTurnPill` is the one line that says whose turn it is or how the game
ended, in a round pill between the board and the person's own strip.
`emphasis="yours"` is the viewer's own turn (`tintSubtle` under
`onPrimarySoft`); otherwise it is the sunken well. `tone` adds a small
`success` or `warning` mark; the words carry the meaning. With `live` the
words are the screen's polite status region (`role="status"`,
`aria-live="polite"`); text a listener needs but the eye already has from
the seats goes in a `VisuallyHidden` inside `title`. `note` (a countdown)
and `trailing` (game facts) sit outside the region, so a ticking clock never
re-reads the line.

`GameActionBar` is what the person can do now: the game's `items` (`{ id,
label, testId, onPress, disabled?, emphasis?: 'primary', pressed? }`) and
then the frame's own commands in `children`. Items are outlined secondary
buttons; `emphasis: 'primary'` is the one next step; `pressed` makes an item
a tool toggle with `aria-pressed`. The row wraps, has no margins of its own
and draws nothing when empty, so it works under the board and in a sticky
footer.

`GameWatcherCount` is an eye and a compact count (`12.4K` from
`formatCompactNumber`, the exact number on `data-value`), named for a
listener by the caller's `label`. `SpectatorIndicator` takes an optional
`count` and shows one beside it. `GameWatchingFooter` is the calm bar for
someone watching: an eye, the caller's words ("You're watching"), an
optional detail and one action at the far edge.

## Game over

`GameResultHeadline` says the outcome in the `displayXl` style ("You win",
"You came 2nd", "Erin wins") with an optional caption line (the reason).

`GameStandings` is an ordered list in a panel, one row per player (one to
eight), sorted by `place`. Each row shows the place (`ordinal`, or
`formatOrdinal(place, locale)` from `game-ordinal`, which reads the
locale's `Intl.PluralRules` ordinal rule), the avatar, the name (truncated),
an optional readiness tag ("Ready" in the success wash) and the score in
the `stat` style; `scoreLabel` names the score for a listener. The viewer's
row (`you`) is the soft blue and `aria-current`.

`GameStatTiles` is a grid of `GameStat` tiles for a solo game's numbers;
each tile's `dataSet` lands on its tile (a test id, the raw value).

## Commands, timers and states

`GameActionButton` accepts a promise-returning `operation`.
`variant="solid"` is the one next step, in blue; every other command is a
neutral outline. Pending commands cannot be submitted twice; success
appears on the button and errors remain retryable. Reserve confirmation
dialogs for actions whose consequences need confirmation. Settings and
routine status belong inline.

`GameCountdown` reads the host's injected `ClockProvider`. Supply an
absolute deadline, `null` to hide it, and optionally `pausedAt` to show a
frozen snapshot. It displays seconds and releases its timer when hidden or
unmounted. It never starts, delays or ends a game. The caller enforces the
deadline.

Styles use the shared theme tokens, support both color schemes, and honor
`prefers-reduced-motion`. Timers have live announcements disabled so
changing seconds do not interrupt assistive technology. Controls retain
native keyboard behavior and visible focus rings. Contracts are pinned in
`../ui-root-harness-ts/tests/game-chrome.test.tsx` and
`game-frame.test.tsx`.
