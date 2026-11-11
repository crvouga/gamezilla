# Game screens

Every game is shown through the same template screens. A game supplies its
board, its copy and its data; it never supplies a screen. This is the standard
those templates follow, and the catalogue of every screen. What the screens
must do is in [`specs/games/`](../../../specs/games/); how they are built and
reviewed is the [Storybook agent workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow).

## The standard

1. **One job per screen.** A screen does one thing a person would name in a
   few words: pick who sits in a seat, choose a clock, play, look at the
   moves, read the result. When a screen needs a second job it becomes a
   second screen. Prefer many small screens over a few crowded ones.
2. **Five kinds of screen, and nothing else.**

   | Kind | Holds | Built from |
   | --- | --- | --- |
   | Hub | Rows that lead onward, each with its current value. No form, no board. | `EmbeddedScreen`, `MenuSection`, `MenuRow` |
   | Choice | One short list of choices. Pressing one applies it and returns. | `EmbeddedScreen`, `MenuSection`, `MenuRow` / `GameChoiceGrid` |
   | Form | One form and its one submit. | `EmbeddedScreen`, fields, one `GameActionButton` |
   | Stage | The board and only what play needs now: the seats, one status line, the board's own actions, one way to the game's commands. | `GameScreen`, `GameSessionLayout`, `GameBoardStage` |
   | Result | What happened and at most three things to do next. | `GameScreen`, `GameResultHeadline`, `GameStandings` |

3. **At most one filled (primary) command per screen.** Everything else is an
   outline or ghost button, or a row.
4. **No disclosures, tabs or toggles that hide part of a screen.** What would
   sit behind one is a screen of its own, reached by a row.
5. **Destructive and irreversible commands confirm first** (`MutationModal`),
   and their dialog is owned by the template's shell, so it survives the
   screen under it changing.
6. **Every state is named.** A screen's view takes a status union (loading,
   empty, failed with a retry, denied, ready); it never infers a state from
   which optional props happen to be set. Connection and refusal notices
   belong to the shell and show on every screen of the template.
7. **The same screens on every size.** A view does not read the layout mode
   to pick what it shows. A stage may place its rail beside the board when
   there is room (`GameLayout`, a container query); that is the only
   difference between a phone and a desktop.

## Places: the explicit state machine

A template is a set of small screens and one state machine that says which
is shown. The machine has two parts:

- **Stage** — where the thing itself stands, read from the room or the
  database: a custom game is `none`, `configuring`, `active`, `completed` or
  `cancelled`. Nobody navigates a stage; it changes when the game does.
- **Place** — the screen this device shows within the stage. Each stage has
  one home place and the few places reachable from it. A place is device
  local: it is never the space-wide game screen (`useGameScreen`), which
  only says which template everyone is in.

`@pkgs/turn-game-client-ts/screen-places` holds the machine
(`defineScreenPlaces`, `placeIn`, `placeBehind`) and
`@pkgs/turn-game-client-ts/use-screen-place` the hook a container reads it
with. Each template declares its places in `<template>-places.ts`: a
discriminated union on `screen`, the home and the allowed screens of every
stage, and each place's parent.

- A place opened in one stage does not survive into another: when the stage
  changes the device is on the new stage's home.
- Back (`DefineBackButton`) goes to the place's parent; from a stage's home
  it leaves the template for the game's choices.
- The view is one `<Switch>` on `place.screen`. No view chooses what to show
  from booleans computed out of the layout or of each other.
- A container holds the hooks and renders `<Template>ScreenView` with the
  stage, the place and `onOpen(place)`. Stories pass both as args, so every
  place of every stage is a story.

## The catalogue

Story ids are `screens-games-<template>-<place>`; every place has stories for
each of its states, with phone and desktop baselines in both themes.

### Custom game (`custom-game`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `none` | `start` | Choice | Play the bots at once, or set a game up |
| `configuring` | `lobby` | Hub | Who sits where, what is agreed, get ready, start |
| | `seat` (a side) | Choice | Who sits in this seat |
| | `options` | Form | The game's own options |
| | `clock` | Form | The clock, and swapping sides |
| | `private-setup` | Stage | The person's own private setup |
| `active` | `play` | Stage | Play the live position |
| | `commands` | Choice | Offer a draw, resign, cancel, look back |
| | `moves` | Stage | Step through the moves played |
| `completed`, `cancelled` | `result` | Result | The outcome, the standings, what next |
| | `moves` | Stage | Step through the moves played |

The play screen always shows the live position. Looking at an earlier
position is the `moves` place; leaving it returns the board to live.

### Finding an opponent (`multiplayer`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `loading`, `unavailable`, `denied` | `status` | Result | Say why there is nothing to do, and what to do about it |
| `idle` | `find` | Hub | Find an opponent at the chosen clock |
| | `time-control` | Choice | Choose the clock |
| | `ratings` | Hub | The person's ratings, per speed |
| | `guide` | Hub | How finding an opponent works |
| `searching` | `searching` | Result | Waiting, and stopping |
| `setup` | `private-setup` | Stage | The person's own private setup before the first move |
| `playing` | `play` | Stage | Play the live position |
| | `commands` | Choice | Offer a draw, resign, abort, flip the board |
| | `moves` | Stage | Step through the moves played |
| `finished` | `result` | Result | The outcome and rating change, rematch or a new opponent |
| | `moves` | Stage | Step through the moves; copy the game record |
| | `ratings` | Hub | The person's ratings, per speed |

### Puzzles (`puzzle`, `stats`, `stats-review`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `loading`, `offline`, `limited`, `empty`, `waiting` | `status` | Result | Say why there is no puzzle, and what to do about it |
| `playing` | `play` | Stage | Solve the puzzle on the board |
| | `feed` | Hub | What the feed serves next, one row per setting |
| | `feed-target`, `feed-history`, `feed-themes`, `feed-advance` | Choice | One feed setting each |
| `finished` | `result` | Result | Solved or failed, the rating change, the next puzzle |
| (stats) | `summary` | Hub | Rating, played, solved, accuracy; onward to the trend and the log |
| | `trend` | Hub | The rating over time |
| | `log` | Hub | Every puzzle played, each opening its review |
| (review) | `review` | Stage | Step through a played puzzle |

### Puzzles and packs (`puzzle-library`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| library | `library` | Hub | Continue, solved, browse, my creations and playtests by their counts; the starter packs; a row each to create a puzzle or a pack |
| | `continue`, `solved`, `browse`, `mine`, `playtests` | Hub | One list each, with its own empty state and its own "load more" |
| builder | `builder` | Hub | The draft's steps and where each stands; the one next step as its filled command |
| | `details` | Form | Title, description, difficulty |
| | `board` | Stage | The game's editor (a pack: its puzzles), undo and redo |
| | `preview` (a pack's puzzle) | Stage | The draft as a solver sees it |
| | `publish` | Hub | Playtest, validate, publish; why not yet; view and withdraw |
| | `copies` | Choice | The kept draft copies |
| edition | `edition` | Hub | A published puzzle or pack: start, continue, edit |
| attempt | `attempt` | Stage | Solve it: the board, its save line, undo, redo and restart, one control onward |
| | `progress` | Hub | The pack place and next puzzle, figures, the completion, saved positions |

Here the stage is what the person has open (`ContentSubject`: the library,
one document's builder, one edition, one attempt), so opening anything
lands on its home, also another thing of the same kind. Solved attempts and
playtests are lists of their own (`solved`, `playtests`) so that no list
screen holds two. The builder's shell (the draft's title, its save line, a
failed save, a conflicting copy, a refused publication, the confirmation
dialogs) shows on every builder place. The stage ids are
`screens-puzzles-content-<stage>` for a home and
`screens-puzzles-content-<stage>-<place>` otherwise.

### A game's menu and settings (`game-choices`, `settings`)

A game's menu is a hub of the template screens its capabilities offer. A
game's settings are rows it declares as data (`GameClient.settings`: a label,
a value, a permission, a choice list or a template screen); the framework
draws the settings hub and every screen behind it. `defineGameClient` has no
`Screen` to give.

## Verifying a screen

- **Handles stay.** A control keeps its `data-testid` when it moves to
  another place, so a driver changes only how it gets there.
- **Drivers navigate as a person does.** A harness driver that needs a
  control on another place opens that place through its row, then acts or
  reads. It never falls back to a weaker assertion because a control moved,
  and a read that left the home place returns there.
- **The machine is tested as a machine.** Each `<template>-places.ts` has a
  property test: from every stage and place, any sequence of opens, backs and
  stage changes lands on a place its stage allows, and Back always reaches
  the home in a bounded number of steps.
- **Every place is a story.** A view's stories set the stage and the place
  as args; journeys that cross places are play functions over the template's
  `*ScreenView`.
