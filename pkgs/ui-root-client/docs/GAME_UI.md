# Game UI

The game arena example in the component explorer composes the reusable game
presentation modules. Import each module through `@pkgs/ui-root-client/<module>`.
These components accept labels, content and callbacks; the caller owns rules,
permissions, state, persistence and navigation.

| Layer | Modules | Purpose |
| --- | --- | --- |
| Atoms | `game-clock`, `game-stat`, `game-action-button` | Time, progress and inline asynchronous feedback |
| Sections | `game-section`, `game-player-bar`, `game-status` | Grouped content, a seat at the table, and where the game stands |
| Controls | `game-choice-grid`, `game-disclosure` | Native radio choices and optional inline settings |
| States | `game-search-state`, `game-countdown` | Search feedback and a supplied deadline |
| Layouts | `game-screen`, `game-board-stage` | The game inside its host's chrome, and the play surface with its two seats |

`GameScreen` is an `EmbeddedScreen`: the host (a space) owns the one top bar,
so a game never draws a second one. It requires a `screenId` and a `title`,
shown once in the body. `GameLayout` places its children in the stage and its
`aside` content in the rail; narrow screens use one column.

The board is the largest thing on a game screen. `GameBoardStage` puts the far
seat above it and the near seat below, each a `GamePlayerBar`: avatar, name, a
row of `Badge` facts (side, rating, readiness) and the seat's `GameClock` at
the far edge. An empty seat draws the `Avatar` person placeholder. While a
game is set up, a seat's controls go in the bar's `children`.

`GameStatus` is the one line under the board that says whose turn it is or how
the game ended. With `live` it is the screen's polite status region; text a
listener needs but the eye already has from the seats goes in a
`VisuallyHidden` inside its title.

`GameActionButton` accepts a promise-returning `operation`. `variant="solid"`
is the one next step, in blue; every other command is a neutral outline. Pending commands
cannot be submitted twice; success appears on the button and errors remain
retryable. Reserve confirmation dialogs for actions whose consequences need
confirmation. Settings and routine status belong inline.

`GameCountdown` reads the host's injected `ClockProvider`. Supply an absolute
deadline, `null` to hide it, and optionally `pausedAt` to show a frozen snapshot.
It displays seconds and releases its timer when hidden or unmounted. It never
starts, delays or ends a game. The caller enforces the deadline.

Styles use the shared theme tokens, support both color schemes, and honor
`prefers-reduced-motion`. Timers have live announcements disabled so changing
seconds do not interrupt assistive technology. Controls retain native keyboard
behavior and visible focus rings.
