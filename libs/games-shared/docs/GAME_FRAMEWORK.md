# The game framework

Gamezilla is a game application framework with pluggable games. The
framework owns every lifecycle a person meets around a game — choosing it in
a space, custom games, finding an opponent, matched games, turns, clocks,
results, notices, ratings, history and review — and invokes each game only
through small, typed contracts. A game supplies its mechanics, its board and
its copy. Adding one is [`ADDING_A_GAME.md`](ADDING_A_GAME.md).

## Dependency direction

```text
composition roots (registries, runtime, apps)
        │ list every game
        ▼
   game plugins ──► framework ◄── framework harnesses ◄── game harnesses
 (chess-*, connect-four-*)                                  (each game's -harness)
```

- The framework never imports a game, never names one, and never branches on
  one (`gameViolations`, `gameIdentityViolations`, `import-game-implementation.grit`).
- A game imports the framework and its own packages only; never a sibling
  game and never a registry (a registry would hand it every sibling).
- Only packages declaring `"gameRegistry": true` compose games, and anything
  depending on a registry is one itself. Today: `@libs/games-shared`,
  `@libs/games-client`, `@libs/game-catalog-shared`, `@libs/games-harness`,
  `@libs/room-app-server`, the runtime packages, the synthetic population
  harness and the apps.

## Who owns what

| Package | Owns |
| --- | --- |
| `@pkgs/turn-game-shared` | The contracts: `GameRules`, `TurnGameCapabilities` and their parts (`GameBots`, `MatchmakingCapability`, `HistoryCapability`, `PuzzlesCapability`), `TurnGames` (lookup by id, position and clock), `GamePresentation`, `GameAutomation`. |
| `@pkgs/turn-game-client` | `TurnGamesProvider` and `useGamePresentation`: the shared screens find a position's presentation. |
| `@libs/spaces-shared` | `GameDefinition` and `GameClientDefinition` (what a space can play), `GameOwnRoom` (a game's own room behaviour), `SharedGameModule`, and the space room that composes them. |
| `@libs/game-session-shared` | `defineTurnGame`, custom games (sides, people, bots, readiness, clocks, resignation, draws, rematches, offline solo play) and the shared session module installed once per space. |
| `@libs/game-session-client` / `-server` | The custom-game, history and review screens; the matched-game notice, reminder and availability consumers. |
| `@libs/game-matchmaking-shared` / `-client` | Opponent searches, matched games, ratings per speed, rematches, the multiplayer screen and link. |
| `@libs/game-puzzle-shared` | Puzzles over any game's rules: the space's puzzle session (its room state and messages), puzzle ratings, completion, statistics, the feed and its settings, choosing the next puzzle, the puzzle tables, queries and mutations, and the puzzle link. |
| `@libs/game-menu-client` | `defineGameClient` and the one `GameMenu` every game is offered through. |
| `@libs/game-session-harness` | The conformance contract a game's harness supplies (`PlayableGame` without screens, `HarnessGame` with them, `GameFixtures`), `gameSystem` (a world of any games), shared drivers, and the rules laws (`game-rules-laws`). |
| `@libs/game-matchmaking-harness` | Opponent seeking and the one matched-game scenario world. |
| `@libs/games-harness` | `HARNESS_GAMES`, the conformance matrix, every shared suite and the steps of `specs/games/`. |

A game owns its rules (opaque positions and actions), its board component,
its presentation and notice copy, its UI automation gesture, its own
screens and room behaviour if it has any, and its own rules specifications
in `specs/<game>/`.

## The public API

The framework's public API is what a game may depend on. It has three
layers, and everything else is the framework's own implementation, free
to change without touching a game:

- **Core contracts** — the shapes a game implements: its rules, its
  presentation, its automation.
- **Capability contracts** — what a game supplies to be offered a
  capability (bots, a clock namespace and notice copy, a game record), in
  the same modules as the core contracts.
- **Product composition** — the constructors that turn a game into the one
  value its registry accepts, and, for its harness, the conformance
  adapter, the scenario world, and the drivers, reads and fixture helpers
  its own specifications use.

**Internal implementation** is never public: stored state and its types
(`custom-game-state`, `game-state`, the `chess_multiplayer_*` tables),
transport and mutation clients (`custom-game-commands`,
`multiplayer-commands`), room and match-room details (`match-room`,
`custom-game-handler`), screen probes (`custom-game-probe`), direct reads
of a device's tables (`multiplayer-reads`), fixture transactions
(`multiplayer-fixtures`), UI controllers, and the registries.

Each framework package declares its public modules in its manifest
(`"gameApi"`, the `src/<module>` files a game may import). A game
package's `lint` refuses any other import from a framework package, in
its source, tests and steps alike, type-only imports included
(`gameApiViolations` in `libs/tools/scripts/package-boundaries.ts`). The
framework's own packages use each other's modules freely. A need the list
cannot meet is a framework change: a focused read, action or fixture
helper in a public module, or a framework test at the framework's owner.
It is never a new entry for an internal module.

| Package | Public modules (`gameApi`) | For |
| --- | --- | --- |
| `@pkgs/turn-game-shared` | `game-rules` | `GameRules`, `TurnGameCapabilities` and each capability's contract (`GameBots`, `MatchmakingCapability`, `GameNoticeText`, `HistoryCapability`, `GameRecordMetadata`), `GameSide`, and `createTurnGames` for a game's own suites |
| | `game-puzzles` | `PuzzlesCapability`, `PuzzleRecord`, `PuzzleMarks`: what a game supplies to be offered puzzles |
| | `game-presentation` | `GamePresentation`, `GameBoardProps`: the board and the copy the shared screens show |
| | `game-automation` | `GameAutomation`: a synthetic or scripted participant's choice and its board gesture |
| `@libs/game-session-shared` | `turn-game-definition` | `defineTurnGame` and `TurnGame`: the registration |
| `@libs/game-menu-client` | `game-client` | `defineGameClient`, `GameClientPresentation`, the game's own screens and choices |
| `@libs/spaces-shared` | `game` | `GameOwnRoom`, `GameCommandContext`: a game's own room behaviour |
| `@libs/game-session-harness` | `harness-game` | `PlayableGame`, `HarnessGame`, `GameFixtures`, `ReadGameRecord`, `assertHarnessGame`: the conformance adapter |
| | `game-system` | `gameSystem`, `openGameHarness`: a world of any games |
| | `game-navigation`, `space-game-choice` | Choosing a game in a space and moving between its screens |
| | `custom-game-ui`, `custom-game-controls`, `custom-game-lineup` | Making Custom Game choices as a person does (`CustomGameAction`): one choice, the screen's controls, a whole lineup |
| | `custom-game-moves` | The shared board (`CUSTOM_GAME_BOARD`), `makeCustomGameMove`, `customGameBoardTakes`, `playOnCustomGameBoard` (the game's own gesture, then the product's answer) |
| | `custom-game-screen`, `custom-game-reads` | What a person's Custom Game screen shows: a projection of the game, the refusal they were told, their clock, invitations, the move list |
| | `custom-game-history` | Fixture: a legal earlier history played through the real move boundary |
| `@libs/game-matchmaking-harness` | `matched-game-world`, `matched-game-app.steps` | The scenario's matched game: pairing, both boards, commands and verdicts, the game a device holds (`heldMatchedGame`) |
| | `opponent-seeking`, `multiplayer-board`, `multiplayer-review`, `multiplayer-game-record` | Finding an opponent, the board (`sendMoveFromBoard`), reviewing earlier positions, copying the game record, as a person does |
| | `multiplayer-time`, `matched-game-fixtures` | Fixtures: time passing through the real sweep; a position or a clock set where no person could reach it in time |
| `@libs/game-puzzle-shared` | the modules its manifest lists | Transitional: chess's puzzle screens, harness, server and sub still use the platform's puzzle session, feed, ratings and tables directly. The list shrinks to nothing as those move into the platform's puzzle screens and sub |
| `@pkgs/turn-game-client`, `@libs/game-session-client`, `@libs/game-session-server`, `@libs/game-matchmaking-shared`, `@libs/game-matchmaking-client` | none | The platform's screens, consumers, commands and storage: a game never imports them |
| `@libs/games-shared`, `@libs/games-client`, `@libs/game-catalog-shared`, `@libs/games-harness` | none | Registries: composition roots import `game-plugins`, `game-plugins.client`, `turn-games` / `game-automations` and `harness-games` / `game-conformance`; a game never depends on one (`gameViolations`) |

Matched-game reads keep the record's durable field names (`fen`, `pgn`,
`white_id`, … — see [Durable names](#durable-names)): a game reads the
values the world returns but never imports their stored type.

## The lifecycle of a registered game

1. **Definition.** `defineTurnGame({ rules, capabilities, automation, own? })`
   in the game's `-shared` package validates the game when its module loads
   and returns the only value the registry accepts: a `TurnGameDefinition`,
   an instance carrying a private brand that a spread copy or a hand-built
   object lacks, so either is refused at type checking. `defineGameClient`
   does the same for the client (`GameClientRegistration`). Neither needs a
   cast.
2. **Registration.** One entry in `GAME_DEFINITIONS`, one in
   `GAME_CLIENT_DEFINITIONS` (client bundles only), one in `HARNESS_GAMES`
   (tests only). Each registry checks, when it loads, that every entry was
   made by its constructor (`assertTurnGameDefinitions`,
   `assertGameClientDefinitions`, and `assertHarnessGame` for an adapter's
   two); the client registry agrees with the turn games entry for entry
   (`assertMatchingGameIds`, naming the entry to add, remove or reorder);
   the harness games agree with the registry (the conformance plan,
   below).
3. **Composition.** The registries are the single source of what is played:
   - the space room (`composeRoomModules`) installs each game's own room and,
     once, every shared module bound to all registered rules;
   - the sync engine's mutations and the server's consumers receive
     `TURN_GAMES` through ports;
   - the client's `TurnGamesProvider` receives every presentation, and the
     game choice lists every client definition;
   - synthetic users receive every `GAME_AUTOMATIONS` entry.
4. **Offering.** The menu, the room, the server and the multiplayer link
   offer a capability exactly when the game's definition supplies it
   (`TurnGames.offers`), and refuse it otherwise — rematches included.
5. **Conformance.** The game is enrolled in every shared suite and shared
   specification for what it offers (below).

## Contracts

`GameRules` is what every lifecycle needs from a two-sided turn game: `id`,
`recognizes` (exactly this game's positions), `initial`, `play` (the next
position, or `null` when refused), `replay`, `legal`, `canWin` (a flag fall
against a side that cannot be beaten is a draw) and `moves` (the accepted
actions, labelled).

Capabilities are present or absent, each with what it needs:

| Capability | The platform offers | The game supplies |
| --- | --- | --- |
| `custom-games` | Custom games with people and bots, invitations, readiness, clocks, resignation, draws, rematches, offline solo play, review | `bots: { difficulties, choose }` (no difficulties = one bot) |
| `matchmaking` | Finding an opponent at a clock choice, matched games, ratings per speed, turn and result notices, rematches, the multiplayer link | `clockNamespace` (`'<id>/'`), `notice` copy for server-sent notices; **requires `history`** |
| `history` | History, statistics and review of finished games; the downloadable record | `record(position, history, metadata)` |
| `puzzles` | Puzzles from the game's positions: the catalogue, the next puzzle, setting it up, judging each move, hints, the solution, ratings, statistics and watchers | `namespace` (`'<id>/'`), `content.validate(record)` (and optionally `content.positionKey`), optionally `judge.canonical(position, action)` and `judge.samePosition(a, b)`, `marks(position, action)` (the cells a hint or a wrong move shows) and `isCell(cell)`; **requires nothing else** |

A game never supplies a placeholder for a capability it does not offer, and
the platform shows, accepts and tests nothing for an absent one.

Finding an opponent requires history: every finished matched game offers
its game record (`specs/games/matched-game-record.feature`), which only
`history.record` writes. `TurnGameCapabilities` makes `matchmaking`
without `history` a type error, and `createTurnGames` (so `defineTurnGame`)
refuses it for what a type cannot see: `<id>: offering matchmaking needs
history too (every finished matched game offers its game record) — add
capabilities.history`. The requirement is `CAPABILITY_REQUIRES`. History
alone, without matched games, is custom-game history, statistics and
review; its record is never copied.

Client extension points (`defineGameClient`): `presentation` (board, side
names, ending copy), optional `choices` and `screens` (the game's own
screens, shown space-wide), `settings`, `Frame` (data its own screens
share) and `SessionEffects`. A game screen navigates with `useGameScreen()`;
it never renders the platform's screens itself.

## Semantics

What each contract promises: who calls it and when, what it may trust,
whether it computes, proposes or commits, who owns the state and its side
effects, what a duplicate, a stale or interrupted call, a refusal and an
error do, and which code owns the guarantee and which test proves it. The
rule underneath every row: **a game makes domain decisions, as pure
functions of what it is given; the framework owns concurrency, commits,
deduplication, cleanup and recovery.** A game function never writes,
schedules, retries or remembers anything.

### `GameRules`: `play`, `replay`, `legal`, `canWin`, `moves`, `initial`

- **Callers.** Custom games: `playCustomGameMove` (`play`, only while the
  game is active), `customGamePositionAt` / `assertCustomGamePosition`
  (`replay`), `customGameLegalMoves` (`legal`, empty unless active),
  `customGameWinOrDraw` (`canWin` on resignation, a flag fall or an
  absence), all in `@libs/game-session-shared`. Matched games:
  `playMultiplayerMove` (`game.ts`), `settleMultiplayerClock` (`canWin`),
  `createMultiplayerGame` (`initial`). Screens: `moves` for move lists and
  review.
- **Inputs.** A stored position is trusted only after `replay` of its
  accepted actions reproduces it (custom games refuse a retained position
  that does not, before anyone plays or reviews from it). A client's
  action is shape-checked by the command schema and is otherwise
  untrusted: `play` is the only judge of legality.
- **Compute only.** Each function is pure and deterministic. The
  framework commits the result: the space room's command result
  (`changedCustomGames`) or the mutation transaction
  (`runGameCommand` → `MultiplayerGameRepository.save`).
- **Refusal and errors.** `play` returning `null` is a refusal
  (`move is illegal`, `CHESS_ILLEGAL_MOVE`) and nothing changes. A throw
  fails the room command or mutation as a whole, so nothing is saved.
- **Duplicates and stale calls.** A custom-game move names its ply (a
  stale one is `board changed`). A matched-game move names its revision
  and request id: a repeated request id answers as before
  (`repository.repeated` / `remember`), and both people's owner lock
  serialises concurrent commands.
- **Proof.** `conformance/rules/game-rules` (the rules laws:
  `game-session-harness/src/game-rules-laws.ts`),
  `reference-game/faulty-games`, `conformance/custom-games/retained-history`,
  `conformance/matchmaking/match-authority` (wrong, repeated, stale and
  late moves; concurrent requests consume one turn),
  `game-session-shared/tests/independent-rules`.

### `GameBots.choose`: asynchronous bot decisions

- **Callers and lifecycle.** Only an active custom game whose side to
  move is a bot. `customGameEffects` schedules a `PlayCustomGameBot` wake
  one second after the turn starts, and cancels and reschedules it on
  every change. The wake runs as the room's scheduler
  (`handleCustomGameWake`), which calls `choose` with the room's seeded
  `random`, so a replay decides alike. An offline solo game chooses on the
  device and sends the chosen action in the wake, which is then
  validated like any move.
- **Propose, then commit.** `choose` proposes an action. The framework
  plays it through `play` and commits it in the same room command.
- **Superseded or stale.** A wake for another game, ply or side, or for a
  finished or paused game, commits nothing (`currentWake`). A wake older
  than the turn is refused (`choices changed`). A redelivered wake finds
  its ply already played and does nothing.
- **Errors and recovery.** An illegal proposal is refused
  (`move is illegal`) and the game is unchanged. `null` while the game is
  active throws (`active bot game has no legal move`). A throw leaves the
  wake undelivered: the scheduler keeps it and redelivers it. Both are
  contract violations that the bot law refuses before a game ships.
- **Proof.** `conformance/custom-games/bots` (two bots play only legal
  actions until the game ends), `faulty-games` (a bot choosing illegally
  is refused), `custom-game-control.qnt` `_staleBot` / `_wrongBot`
  (`tests/quint/custom-game-control.binding.ts`).

### `GameAutomation`: `choose` and `perform`

- **Callers.** Only drivers, never the product: synthetic users
  (`synthetic-user-application.ts`), the runtime journeys and the
  harnesses (`makeCustomGameMove`). `choose` proposes among `legal`, and
  `perform` makes the one pointer gesture on the board.
- **Commit.** Through the product, as a person's gesture would. A refusal
  is the product's.
- **Errors.** A choice outside `legal` fails the synthetic user, and so
  does a gesture the product never acknowledges. A rejected `perform`
  propagates to the driver.
- **Proof.** The rules laws ("the automated participant only ever chooses
  a legal action") and `faulty-games`.

### `history.record`: the game record

- **Callers and lifecycle.** `gameRecord`
  (`game-matchmaking-shared/src/game-record.ts`) calls it on read, when a
  screen offers a finished matched game's record. It is never stored or
  copied. An ongoing or aborted game has no record, and the game is not
  asked.
- **Inputs.** Trusted, from storage: the final position and history, and
  `GameRecordMetadata` (both people's names and ratings, the result and
  reason, the clock choice converted from its id).
- **Compute only.** Pure. It is the same text however often it is asked.
- **Proof.** `game-matchmaking-shared/tests/game-record-and-flag-fall`
  (asked once finished, with what), `conformance/history/game-record`
  (`gameRecordLaws`), `faulty-capabilities`,
  `specs/games/matched-game-record.feature`.

### `GamePresentation`

- **Callers.** The shared screens only: boards
  (`multiplayer-board.tsx`, `custom-game-board.tsx`, `game-history.tsx`)
  and the copy for sides, endings and draws on time (`multiplayer-status`,
  `custom-game-status`, `game-record-label`, `useGameSideLabel`), found
  for a position through `TurnGamesProvider`.
- **Compute only.** It renders what it is given. A board reports a
  gesture through `onAction`, and the framework decides whether to send
  it.
- **Proof.** `conformance/rules/presentation` (`gamePresentationLaws`),
  `faulty-capabilities`.

### Matchmaking handoff

- **Lifecycle.** `beginOpponentSearch` validates the person, the space,
  the clock choice and the unfinished-game limit. It then enqueues
  `OpponentRequested` (outbox id: person and request id). The
  `chess.form-opponent-match` consumer pairs searches and, in one
  transaction, creates the game, both seats, both people's unavailability,
  the deadline, the notices and the match-room publish
  (`acceptGameMatch` → `createMultiplayerGame`). Storage owns the game.
  The match room only projects it.
- **Duplicates and retries.** One game per match (`match-handoff.ts`
  returns early on an existing `match_id`, which a unique index backs).
  Formation retries in five-second slots (`formation-retry.ts`), each one
  outbox id. The match room ignores a non-service sender, another game, a
  lower revision, and a finished game reopened (`match-room.ts`).
- **Space gone.** Watching needs a space that has not ended. When a space
  ends or a member leaves, the room disconnects and the game carries on
  in storage.
- **Proof.** `game-matchmaking-shared/tests/match-room-protocol`,
  `conformance/matchmaking/finding-an-opponent`,
  `game-matchmaking-harness/tests/opponent-search-transaction`,
  `specs/games/finding-an-opponent.feature`,
  `finding-an-opponent-devices.feature`.

### Custom-game commands

- **Callers.** People's devices, through the space room (`chess-custom-cmd`:
  change, local change), and the room's scheduler (bot turn, time up).
- **Validated.** The payload schema (`custom-game-choice`), then the
  capability grants at the room boundary (`custom-game-permissions`),
  then the domain refusals (`customGameRefusal`). A choice names its game
  and revision: another game is `choices changed`, and a stale revision is
  refused for settings, start and cancel.
- **Commit and duplicates.** The handler computes. The room commits the
  state change and the command id's verdict atomically, and replays the
  stored verdict for a repeated command id (`RoomServer`, invariant
  `command-id-dedup-stable`). A refusal is a conflict with its reason, and
  a throw fails the command without a stored verdict.
- **Proof.** `custom-game.qnt` (`_competingChoices`), the
  `specs/games/custom-game-*.feature` refusals,
  `conformance/custom-games/retained-history`.

### Completion, rating and history recording

- **Matched games.** A game ends in exactly one committed transition.
  `MultiplayerGameRepository.save` rates both people and frees them only
  when the game it was given was ongoing and the result is not
  (`rateFinishedGame` skips aborted games). Every writer reads the game
  under both people's owner lock first: commands (`owned(…, lockAt)`),
  the availability consumer and the deadline sweep (`settleDueGame`), so
  a sweep and a resignation that meet can never both end the game. A
  retried command is answered from its request receipt, and a retried
  mutation from its stored verdict (`storedReplayVerdict`).
- **Custom games.** `finishCustomGame` ends the game in place. It enters
  the history once, in the transition that replaces it with a new game.
  Custom games are never rated.
- **Proof.** `game-matchmaking-shared/tests/settle-due-game` (regression
  `matched-game-sweep-ends-a-game-twice`),
  `matched-game-ratings.feature` ("Resigning again counts the rated
  matched game only once"), `matched-game.qnt` `invRatedOnce`,
  `matched-game-interruption.feature` (one rated game after resuming),
  `game-session-shared/tests/independent-rules` ("a finished game enters
  the history once"), `conformance/history/cancelled-game`.

### Game history lists each game once

`useGameRecords` (`@libs/game-session-client`) lists the space's
custom-game history and current game beside the person's matched games.
It does not merge by id, because no game can be in both:

- matched games never write a room's custom-game history;
- their ids are the match id or `rematch:<id>`, while a custom game's id
  is its room command's id;
- the custom-game history never repeats a game (above);
- a matched game is one row (a primary key, and a unique `match_id`).

### Rematch

- **Matched games.** An offer needs a finished game that was not aborted.
  Accepting needs the other person's waiting offer, and offering back
  accepts. Both people must be free. The new game is `rematch:<id>`, so
  one finished game has at most one rematch, and the owner lock
  serialises two acceptances. After the rematch starts, a later accept is
  refused (`CHESS_REMATCH_ENDED`).
- **Custom games.** The creator rematches a finished game. The sides swap,
  the new game's id is the command id, and the finished game enters the
  history once.
- **Proof.** `matched-game-rematch.feature` ("Offering a rematch back
  accepts the rematch", "Nobody can accept the rematch once its rematch
  offer has ended"), `matched-game.qnt` `invOffers`,
  `custom-game-rematch.feature`, `custom-game-completion.feature`.

### Reconnecting after a result

- A result is committed in storage (matched) or in the room (custom), and
  a returning device reads the committed result. Nothing a device kept
  can revive a finished game.
- A daily game's result notice is one outbox message per game, revision
  and outcome. Its consumer upserts by source and person without clearing
  a dismissal, so a redelivery never brings a dismissed notice back.
- **Proof.** `matched-game-recovery.feature` ("Returning after the
  opponent resigns shows the accepted result"),
  `matched-game-interruption.feature` ("Returning finds a result accepted
  before the pause"), `matched-game-result-notices.feature` ("A person
  whose phone was offline finds their result notice once it is back
  online"), `custom-game-connection.feature` ("A returning participant
  cannot revive a finished custom game"),
  `game-matchmaking-shared/tests/multiplayer-notices`.

### Cancellation and ending a space

- **Custom games.** `reactCustomGameToSpaceEvent` first expires a clock
  that ran out. Ending the space cancels the game. When someone leaves:
  the creator leaving cancels the game; before the start, the leaver's
  side opens; during play, the leaver resigns, which is a draw when the
  other side cannot win. `customGameEffects` then cancels the bot and
  clock wakes. A cancelled game enters the history like any finished
  one.
- **Matched games.** Aborting is allowed only before both people have
  moved. It leaves no rating and no record, and frees both people.
  Repeating it changes nothing. Stopping a search names its request.
  Ending a space never ends a matched game.
- **Proof.** `conformance/custom-games/space-ending`,
  `conformance/history/cancelled-game`,
  `custom-game-completion.feature`, `custom-game-interruption.feature`,
  `matched-game-abort.feature` ("Aborting an aborted matched game again
  changes nothing"), `matched-game-shared.qnt` `invAbortHasNoWinner`,
  `finding-an-opponent.feature`,
  `game-matchmaking-harness/tests/opponent-search-cleanup`.

### Not yet proven by a test

These hold by construction today, but no test pins them yet:

- A redelivered result notice stays dismissed. The consumer sends it
  without `resurface`, and `publishNotification` in
  `@libs/notifications-server` keeps a dismissal unless asked to
  resurface it.
- A bot whose proposal is refused leaves its game waiting for the next
  wake or a clock: no new bot wake is scheduled. The bot law refuses such
  a bot before it ships.
- A presentation is a pure function of what it is given.

## Conformance

Every registered game, and the test-only reference game
(`libs/games-harness/tests/reference-game/`), is held to the shared
behaviour for exactly what it offers:

- **Shared specifications.** `specs/games/*.feature` run once per game
  offering everything a feature shows (`SHARED_SPECIFICATIONS` in
  `@libs/games-harness/game-conformance`). A feature may also need a trait
  of the game's rules that not every game has (`GAME_TRAITS`: a side that
  cannot win, a draw by the game's own rules); a game has it exactly when
  its fixtures show it (`secondSideCannotWin`, `drawByRules`), and a game
  without the fixture is held by the rules laws to never reach such a
  position. The moves played and a copied game record are checked against
  how the game writes its victory's moves (`firstSideVictoryLabels`, held
  to the rules' own labels), and a game whose matched games offer a game
  record reads it back in its own format (`readRecord`), never through the
  game's code. Each game's run is its own test,
  `<scenario> [<game>]`, recording its own evidence obligation
  (`scenario:<scenario> [<game id>]`), so the job log and Atlas name the game.
  The `specs/games/*.qnt` models are listed the same way and replay once per
  such game (`defineTraceVariants`; `<trace> [<game>]`, `trace:<n> [<game
  id>]`); the custom-game and matched-game models follow each game's known
  victory, which takes exactly seven moves (`tests/quint/model-game.ts`),
  and play the matched games at each game's own clock choices (its clock
  namespace). The decision tables, structures and objectives check every
  such game in their one run (the matched-game watch and unfinished-game
  tables as one server layer per game).
- **Shared code suites.** A test under `tests/conformance/<area>/` of
  `@libs/games-harness` runs once per game its area binds (`rules`: every
  game; otherwise the capability of that name), as `<game> › <area> › <suite>`.
  The rules laws are property tests (`assertProperty`): positions name one
  game, replay reproduces every position, the moves shown are the moves
  played, only legal actions are accepted, and automation and bots choose
  legally. The capability laws (`game-capability-laws`) hold every game's
  presentation to naming the game and each side apart, describing and
  labelling every ending its rules reach, and describing a draw on time
  (`conformance/rules/presentation`), and every game whose matched games
  offer a record to writing both people on their sides, the result, the
  clock choice and this game's moves, as its `readRecord` reads them
  (`conformance/history/game-record`). A suite registers its tests inside
  `forEveryGame`.
- **Independent oracles.** Expected outcomes come from each game's
  `fixtures` — a known first-side victory, known refused openings and, for
  a game that has one, a known line to a position its second side cannot
  win,
  written from the game's own laws — or from the contract, never from asking
  the implementation whether it agrees with itself. Faulty copies of the
  reference game (`reference-game/faulty-*.test.ts`), each defined through
  `defineTurnGame` and `defineGameClient` like any game, prove each law
  refuses the fault it names — and only that law, for that reason: rules,
  bots, automation, a strength offered twice, endings and side names lost,
  and a record with the wrong people, result or game.
- **The matrix.** `tests/game-conformance-matrix.test.ts` derives the
  game × area matrix from offered capabilities and the suites that require
  a case of each game, prints it, and fails on every problem
  `planConformance` (`@libs/games-harness/game-conformance`) finds, each
  saying what to fix: a game in `GAME_DEFINITIONS` but not `HARNESS_GAMES`
  or the reverse, out of order or with another definition; a code suite
  that registers no case for any game it binds, or never calls
  `forEveryGame`; an offered capability no suite or specification requires
  a case of; a specification of `specs/games/` without a
  `SHARED_SPECIFICATIONS` entry, an entry without a specification, listing
  nothing, only a trait, or a need that is neither a capability nor a
  trait. A code suite counts for a game only when it registers a case of
  it: `planCodeSuites` loads each suite inside a running test, where
  `bun:test` refuses every registration, so an empty file binds nothing.
  The planner is pure, and `tests/game-conformance-plan.test.ts` proves
  each refusal on fake registries. An unoffered capability is `—`
  (unsupported), never "not tested".
- **Attribution and isolation.** `tests/game-result-attribution.test.ts`
  proves, with the runners' own naming functions, that each game's run of
  every shared specification has its own test name and evidence
  obligation, so no game's verdict satisfies another's;
  `tests/game-order-isolation.test.ts` proves the plan, the matrix and the
  laws' verdicts are the same whatever order the games are listed or
  checked in.
- **Depth.** The same suites run in both check profiles; `bun check-nightly`
  replays more property runs and Quint traces (`check-profile.ts`).

The matrix today:

| game | rules | custom-games | matchmaking | history | puzzles |
| --- | --- | --- | --- | --- | --- |
| chess | bound | bound | bound | bound | — |
| Connect Four | bound | bound | bound | bound | — |
| counting race (reference, test-only) | bound | bound | — | bound | — |

## Durable names

Names that are stored or sent keep their established identities, even where
they now serve every game: the platform namespace `GAME_PLATFORM_NAMESPACE`
(`'chess'`: table domain, room attributes, outbox and notice messages),
tables `chess_multiplayer_*` and `chess_opponent_searches`, room modules
`chess/custom` and `chess-match`, refusal codes `CHESS_*`, the seat tokens
`white` / `black` (first and second side), the record fields `fen` / `uci` /
`san` / `pgn` (position, action, label, history), chess's unprefixed clock
namespace, and the space-wide game screen (`games/screen`). The unprefixed
namespace `''` — of clock choices and of puzzles — belongs to the game
whose id is `GAME_PLATFORM_NAMESPACE` alone: `defineTurnGame` grants it to
that game (`unprefixedNamespace`), and `createTurnGames` refuses it for any
other (`<id>: the unprefixed clock namespace "" belongs to the platform's
durable game alone — use "<id>/"`, and likewise for the puzzle
namespace). Renaming any of
them would change stored histories, pending offline mutations or queued
messages. A game's own positions and actions are stored verbatim: a game that
changes its encoding keeps `recognizes`, `play` and `replay` accepting every
position and action already stored.

## Fit for future games

The shared sessions serve **two-sided, alternating-turn, perfect-information**
games whose state is one opaque position: chess, Connect Four, Gomoku (any
grid, encoded in the position), Blockade (walls and steps are actions).
Beyond that class:

- **More than two players, simultaneous actions.** The seats are two
  (`GameSide`), and a move passes the turn. Such a game registers its own
  room behaviour (`GameOwnRoom`) and screens without the turn capabilities;
  a shared multi-seat session would be a new shared module and capability.
- **Hidden information** (Battleship). Room state is shared with everyone in
  the space, so the shared sessions cannot keep a side's private state; it
  needs a per-viewer projection of the position before it can be offered.
- **Single-player, puzzle-first** (Numberlink). Puzzles are chess's own
  screens, not a framework capability. Registering a game without turn
  rules means widening `GAME_DEFINITIONS` from `TurnGameDefinition` to
  `GameDefinition` (the space room already composes such definitions) and a
  client without a turn-game presentation.

## Known limits

- The shared suites live in one package, so changing any game reruns every
  game's shared conformance; each game's own rules suites stay in its own
  package and rerun only for it.
- Chess's `multiplayer-*` features keep only what makes chess chess:
  flipping the board, a move made with the keyboard by its squares, an
  earlier position heard by its move in algebraic notation, a game record
  in Portable Game Notation another chess program opens, a king and a
  knight winning on time, and checkmate and chess's draws (matched-game
  notices, reminders, records, review, watchers, being offline, recovery,
  ownership, accessibility and interruptions are every game's, like
  finding an opponent, sides, clocks, daily games, low on time, ratings,
  blocks and results by the game's own rules). Chess's `custom-game-*`
  features keep only chess's own rules: the board facing a colour,
  promotion, castling and en passant, algebraic notation, checkmate, drawn
  positions, the puzzle rating and a bare king's flag fall.
- The custom-game and matched-game models are every game's. Chess keeps
  only its puzzle and Lichess models; a model that moves takes its
  model-check task and its share of chess's spec parts to
  `@libs/games-harness`, which the PR runner's capacity (`ci-load.ts`)
  needs.
- The game models follow a first-side victory of exactly seven moves
  (Connect Four's shortest), so every game supplies one; a game whose
  victories all take longer needs the models' bound raised with it. The
  matched-game models therefore end only by that victory or by agreement,
  time, resignation, aborting or deletion: no fixture shows a draw or a
  second-side victory by the game's own rules short enough for every game
  (Connect Four's shortest draw fills its 42 cells). A draw by the game's
  own rules is a feature instead (`matched-game-rules-draw`, over each
  game's `drawByRules`), and chess's own endings (checkmate, stalemate,
  repetition, mating material, fifty moves) stay in its features. Flipping the board is chess's alone (`canFlip`), specified by
  `specs/chess/multiplayer-flip-board.feature`.
- No contract lets a shared scenario make a move with the keyboard alone
  or hear a move announced: `GameAutomation.perform` is the board's one
  pointer gesture, and `GamePresentation` names sides and endings but not a
  move. The shared custom-game and matched-game accessibility features
  therefore cover only the platform's own controls (choosing a bot,
  starting; seeking, resigning, aborting, offering a draw or a rematch) and
  what the status line and announcements say; a keyboard move and a move
  heard by name stay chess's own (`specs/chess/multiplayer-accessibility.feature`
  and `multiplayer-move-list-review.feature`, its board and notation) until
  the contract gains a keyboard gesture and a spoken label for an action.
- A game's own Gherkin parameter types join the one list the spec check
  reads (`libs/harness/src/parameter-types.ts`).
