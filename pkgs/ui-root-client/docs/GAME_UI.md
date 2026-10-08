# Game UI

The game arena example in the component explorer composes the reusable game
presentation modules. Import each module through `@pkgs/ui-root-client/<module>`.
These components accept labels, content and callbacks; the caller owns rules,
permissions, state, persistence and navigation.

| Layer | Modules | Purpose |
| --- | --- | --- |
| Atoms | `game-clock`, `game-stat`, `game-action-button` | Time, progress and inline asynchronous feedback |
| Sections | `game-header`, `game-section`, `game-player-card`, `game-versus` | Introductions, grouped content and player lineups |
| Controls | `game-choice-grid`, `game-disclosure` | Native radio choices and optional inline settings |
| States | `game-search-state`, `game-countdown` | Search feedback and a supplied deadline |
| Layouts | `game-screen`, `game-board-stage` | Responsive stage and information rail, with a framed play surface |

`GameScreen` requires a `screenId` and uses the shared screen shell.
`GameLayout` places its children in the stage and its `aside` content in the
rail; narrow screens use one column. `GameVersus` accepts two player slots.
Use `stackOnSmall` when either slot contains additional controls.

`GameActionButton` accepts a promise-returning `operation`. Pending commands
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
