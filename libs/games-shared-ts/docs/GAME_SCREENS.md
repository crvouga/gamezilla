# Game screens

Every game is shown through the same template screens. A game supplies its
board, its copy and its data; it never supplies a screen. This is the standard
those templates follow, and the catalogue of every screen. What the screens
must do is in [`specs/games/`](../../../specs/games/); how they are built and
reviewed is the [Storybook agent workflow](../../../pkgs/ui-root-harness-ts/README.md#agent-workflow).

## Screen names

Every screen inside a space is named by where it sits and what it is for,
the same way in component and file names, `screenId` (`data-screen`),
place keys, story titles and story ids:

- **Home** — the root (hub) screen of a level: `SpaceHome` (no game
  chosen), `GameHome` (a game's menu), `CustomGamesHome`,
  `MatchmakingHome` (finding an opponent), `PuzzlesHome`,
  `PuzzlePacksHome`, `HistoryHome`.
- **Setup** — getting a game ready before play: `CustomGameSetup` (the
  lobby) and its sub-screens (`Setup seat`, `Setup invite`, `Setup options`,
  `Setup clock`), and `…PrivateSetup` (a person's own secret setup).
- **Stage** — where a mode is actually played, around the board:
  `CustomGameStage`, `MatchmakingStage`, `PuzzleStage`, `PuzzlePackStage`;
  its menu and moves are `Stage menu` and `Stage moves`.
- Everything else is named for its one job: `Result`, `Replay`, `Settings`,
  `How to play`, `Searching`, `Time control`, `Link`, `Import`, `Builder`.

| Screen | View | `screenId` | Place | Story |
| --- | --- | --- | --- | --- |
| Space home | `SpaceHomeScreenView` | (space template) | — | `Screens/Space/Space home/Home` |
| Game home | `GameHomeScreenView` | `game-home` | `home` | `Screens/Space/Game home/Home` |
| Custom games home | `CustomGamesHomePlace` | `custom-games-home` | `home` | `Screens/Space/Custom games/Home` |
| Custom game setup | `CustomGameSetupPlace` | `custom-game-setup` | `setup` | `Screens/Space/Custom games/Setup` |
| Custom game stage | `CustomGameStagePlace` | `custom-game-stage` | `stage` | `Screens/Space/Custom games/Stage` |
| Matchmaking home | `MatchmakingHomeView` | `matchmaking-home` | `home` | `Screens/Space/Matchmaking/Home` |
| Matchmaking stage | `MatchmakingStageView` | `matchmaking-stage` | `stage` | `Screens/Space/Matchmaking/Stage` |
| Puzzles home | `PuzzlesHomeView` | `puzzles-home` | `feed` | `Screens/Space/Puzzles/Home` |
| Puzzle stage | `PuzzleStageScreenView` | `puzzle-stage` | `play` | `Screens/Space/Puzzles/Stage` |
| Puzzle packs home | `PuzzlePacksHomeScreenView` | `puzzle-packs-home` / `…-<list>` | `library` | `Screens/Space/Puzzle packs/Home` |
| Puzzle pack stage | `PuzzlePackStageScreenView` | `puzzle-pack-stage` | `attempt` | `Screens/Space/Puzzle packs/Stage` |
| History home | `GameHistoryHomeScreenView` | `game-history-home` | — | `Screens/Space/History/Home` |

The space-wide game screen (`useGameScreen`, `GamesRoomAttr.screen`) is
synced room state that every device in a space reads, so its values
(`choices`, `custom-game`, `multiplayer`, `puzzle`, `puzzle-library`,
`history`, …) never change; only their names in code
(`GAME_HOME_SCREEN`, `SHARED_GAME_SCREEN.customGamesHome`, …) follow the
scheme. Places are device-local and in memory, so their keys follow it
directly.

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
   | Result | What happened, and what to do next: one filled command and at most three quiet ones. | `GameScreen`, `GameResultHeadline`, `GameStandings` |

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
7. **The same screens on every size.** The host keeps the space bar above the game.
8. **A game stage is one fixed view.** `FixedGameSession` gives custom games,
   matchmaking and replays one reading order. The players, status and move
   history precede the full-width board region. Its contents keep their
   natural proportions. A short window can scroll the board within that
   region, and the action bar stays at the bottom. The result opens over
   the final position. The Storybook stage stability checks measure the
   board and action bar through changes of turn, history and outcome.
9. **What interrupts the board lies over the board.** Who plays whom before
   the game (`GameVersusOverlay`) and how it ended (`GameResultOverlay`) are
   the stage's `overlay`: they cover the board and nothing else, so nothing
   around it shifts. Which one shows is a state machine of its own (below).
10. **A lobby says what is about to be played and has one command.** It
    opens with the mode card (`GameModeCard`: the mode, the game's name, how
    it is won in a sentence, and what is agreed as three facts), then the
    roster as plain rows with each person's ready state, and one large
    command docked under the thumb (`GameLobbyScreen`, `GameLobbyDock`).
    Nothing is dragged: a seat is a row, and pressing it opens its choices.

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

## The stage's overlay: a second explicit machine

What lies over the board is `StageOverlay`
(`@pkgs/turn-game-client-ts/stage-overlay`), a pure transition function
with four states:

| State | Shows | Leaves on |
| --- | --- | --- |
| `none` | The board | `began` (to `versus`), `ended` (to `outcome`) |
| `versus` (a count, 3 to 1) | Who plays whom, counting down | `tick` at 1, `skip` (a press), `ended` |
| `outcome` | The result card | `dismiss` (to `board`), `reset` |
| `board` | The final board, the card closed | `show` (back to `outcome`), `reset` |

`useStageOverlay` feeds it from the template's stage and from injected
timers (`useTimers`), one tick a second. A game this device watched begin
plays the versus card; a game already under way when the screen opened
does not, and a game already over opens under its result card. The views
take the state and one `onOverlay(event)`, so every state is a story and
no view keeps a timer or a flag of its own.

## The catalogue

Story ids are `screens-<mode>-<screen>` (`screens-custom-games-stage`,
`screens-matchmaking-home`); every place has stories for
each of its states, opened at phone and desktop width in both themes.

### Custom game (`custom-game`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `none` | `home` | Choice | Play the bots at once, or set a game up |
| `configuring` | `setup` | Hub | Who sits where, what is agreed, get ready, start |
| | `seat` (a side) | Choice | Who sits in this seat |
| | `invite` (a side) | Choice | Which member of the space to invite to it |
| | `options` | Form | The game's own options |
| | `clock` | Form | The clock, and swapping sides |
| | `private-setup` | Stage | The person's own private setup, and getting ready with it |
| `active` | `stage` | Stage | Play the live position |
| | `commands` | Choice | Offer draw, resign, cancel, look back |
| | `moves` | Stage | Step through the moves played |
| `completed`, `cancelled` | `result` | Result | The outcome, the standings, what next |
| | `moves` | Stage | Step through the moves played |

The play screen always shows the live position. Looking at an earlier
position is the `moves` place; leaving it returns the board to live. An
answer the game is waiting for (a draw offered, a win to claim) is asked on
the play screen, beside offering a draw and resigning (which asks first);
every other command is a row of the game menu (`commands`). While the
connection is away those two stay in their places, held back, under the
notice that says why. The lobby's one filled command is the next thing to do: take a
seat, arrange an incomplete private setup, get ready, then start. It sits in
the lobby's dock, under the mode card and the roster.

`stage` opens under the versus card when the game starts on this device, and
`result` is the final board under the result card: the headline, the
standings and, once the card is closed, a line that brings it back. The
commands for what next are the bar under the board on both.

Code: `libs/game-session-client-ts/src/custom-game-places.ts` (the machine),
`custom-game-screen-view.tsx` (the switch), `custom-games-home-view.tsx`,
`custom-game-setup-view.tsx`, `custom-game-stage-view.tsx` and one
`game-frame-*-view.tsx` per other place, and
`custom-game-screen-view.<place>.stories.tsx`. Drivers move between
places with `@libs/game-session-harness-ts/custom-game-places`.

### Finding an opponent (`multiplayer`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `loading`, `unavailable`, `denied` | `status` | Result | Say why there is nothing to do, and what to do about it |
| `idle` | `home` | Hub | Find an opponent at the chosen clock |
| | `time-control` | Choice | Choose the clock |
| | `ratings` | Hub | The person's ratings, per speed |
| | `guide` | Hub | How finding an opponent works |
| `searching` | `searching` | Result | Waiting, and stopping |
| `setup` | `private-setup` | Stage | The person's own private setup before the first move |
| | `commands` | Choice | Offer draw, abort, flip the board |
| `playing` | `stage` | Stage | Play the live position |
| | `commands` | Choice | Offer draw, resign, abort, flip the board |
| | `moves` | Stage | Step through the moves played |
| `finished` | `result` | Result | The outcome and rating change, rematch or a new opponent |
| | `moves` | Stage | Step through the moves; copy the game record |
| | `ratings` | Hub | The person's ratings, per speed |
| | `home`, `time-control`, `guide` | Hub, Choice | A new game at another clock, one row from the result |

The stage is `multiplayerStageOf` over the game and the search: an
unfinished game comes before a waiting search, and a search before a
finished game. Its names are `idle` (choosing a time control), `searching`
(finding an opponent), `playing` and `finished`.

`home` and `searching` are the same lobby as a custom game's: the mode card
(Ranked match, the game, how it is won, the players, the clock in words),
then one docked command (Find an opponent, Stop). A game found on this
device opens under the versus card with both ratings; `result` lays the
result card over the final board, with the rating change in its caption and
the moves beside a wide board.

Two refinements the specs demand. A finished game keeps the search's hub
one row from its result, because New opponent seeks at the finished game's
clock and nothing else could choose another. And one place outlives its
stage: a person stepping through the moves when the game ends goes on
stepping through them, on the position they chose
(`multiplayerPlaceKept`); every other stage change lands on the new stage's
home, and a place opened before it is forgotten.

### Puzzles (`puzzle`, `stats`, `stats-review`)

The feed (`puzzle-play-places`):

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `loading`, `offline`, `limited`, `empty`, `waiting` | `status` | Result | Say why there is no puzzle, and the one thing to do about it |
| | `feed`, `feed-…` | Hub, Choice | As under `playing` (not for a watcher `waiting`) |
| `playing` | `play` | Stage | Solve the puzzle on the board: one status line, what the solve state allows, the line so far, one row to the puzzle settings |
| | `line` | Stage | Step through the moves played |
| | `feed` | Hub | What the feed serves next, one row per setting; share the puzzle |
| | `feed-target`, `feed-history`, `feed-themes`, `feed-advance` | Choice | One feed setting each |
| `finished` | `result` | Result | Solved, solution shown or skipped; the rating change; the next puzzle, a retry, the puzzle's link |
| | `line` | Stage | Step through the whole line; the next puzzle or a retry |
| | `feed`, `feed-…` | Hub, Choice | As under `playing` |

The stage is `puzzlePlayStageOf` of the feed's pick and the attempt: a
puzzle is `finished` for its solver when it is solved, shown or skipped; a
watcher's board stays `playing`. `play`, `line` and `result` share one board
(`PuzzleScreen`), so a puzzle's last move is still played and heard as its
result arrives; the result keeps the coach's words on the status line. The
move the board is on is the room's: leaving `line` keeps it, and `play` says
so and offers the way back to the latest move. The feed settings edit a
draft: Done saves it, Back from `feed` drops it.

The stats (`puzzle-stats-places`), and the review:

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `loading`, `ready` | `summary` | Hub | Rating, played, solved, accuracy; onward to the trend and the log |
| `ready` | `trend` | Hub | The rating over time |
| | `log` | Hub | Every puzzle played, each opening its review |
| (`stats-review`) | review | Stage | Step through a played puzzle; back to the log |

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
dialogs) shows on every builder place. The story ids are
`screens-puzzle-packs-<stage>` for a home and
`screens-puzzle-packs-<stage>-<place>` otherwise (the library is the packs'
`home`, an attempt their `stage`).

### A game's home (`menu`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `open` | `home` | Hub | The template screens the game's capabilities offer, one emphasised |
| | `how-to-play` | Hub | The game's own words on how it is played |

The menu holds rows that lead onward and nothing else. Choosing a template
screen moves the whole space (`useGameScreen`); how to play is this
device's own place behind the menu, offered as a row when the game says how.

### A game's settings (`settings`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `open` | `settings` | Hub | The rows of the root group |
| | `settings/<row>/…` (a group) | Hub | The rows of a nested group |
| | `settings/<row>/…` (a template screen) | — | The template the row opens, with its own places |

A game's settings are rows it declares as data (`GameClient.settings`: a
key, a title and caption, an optional permission that hides the row from a
person it is denied, and what the row opens: a nested group, or one of the
platform's template screens). The places are derived from that tree, one
per group and one per template screen (`gameSettingsTree`); Back walks up
the tree and, from the root, returns to the menu. A group none of whose
rows the person may see says so. The framework draws the hub and every
screen behind it: `defineGameClient` has no `Screen` to give, and no
`choices`, `screens`, `Frame` or `SessionEffects` either. Story ids:
`screens-game-home`, `screens-game-home-how-to-play`,
`screens-game-home-settings`.

### Loading a puzzle catalogue (`catalogue-load`)

| Stage | Place | Kind | Job |
| --- | --- | --- | --- |
| `denied` | `status` | Result | Say why the person may not load puzzles |
| `ready`, `loading`, `finished`, `failed`, `stopped` | `load` | Hub | The pool, the source file's row, start or stop, the latest load |
| | `source` | Form | Check for the shared file, choose one, upload it, check again |
| `saving` | `source` | Form | The upload under way, and stopping it |

The stage is where the load itself stands: the person's access, this
device's upload of the source file, then the latest load. What a place
shows inside a stage is named too, and is not a stage, because a stage
change returns a device to the stage's home: the line to the load's status
(`offline`, `connecting`, `live`) and the source file's status (`unknown`,
`checking`, `check-failed`, `missing`, `chosen`, `uploading`, `saved`).
While the file is being saved the only place is `source`, so Back leaves
the loader and asks before abandoning the upload; a save that finishes
lands on the hub, and one that does not returns to `source` beside its
retry. The hub's one command and why it is unavailable are derived from
those three (`catalogueLoadCommand`). A game feeds the template with a hook
of facts and commands and a few words (`CatalogueLoadClient`); the same
template shows inside a space (from a settings row) and on a routed page.
Story ids: `screens-puzzles-import`, `-source`, `-status` and
`-routed`.

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
