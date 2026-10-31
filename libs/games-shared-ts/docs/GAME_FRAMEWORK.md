# The game framework

The product is a game application framework with pluggable games. The
framework owns every lifecycle a person meets around a game — choosing it in
a space, custom games, finding an opponent, matched games, turns, clocks,
results, notices, ratings, history and review — and invokes each game only
through small, typed contracts. A game supplies its mechanics, its board and
its copy. Adding one is [`ADDING_A_GAME.md`](ADDING_A_GAME.md). What
the framework guarantees, the evidence behind each guarantee, and what is
still open are in
[`FRAMEWORK_HARDENING_REPORT.md`](FRAMEWORK_HARDENING_REPORT.md).
The independent follow-up and its remaining acceptance work are tracked in
[`FINAL_HARDENING_AUDIT.md`](FINAL_HARDENING_AUDIT.md).

Games can also supply independent `puzzleContent` capabilities through
`defineGame`, or alongside a turn engine through `defineTurnGame`. Shared
authoring, publication, packs, attempts and progression live in the existing
game-puzzle packages; a game supplies opaque rules and its editor, player and
preview. Their integration is
[`ADDING_A_PUZZLE_GAME.md`](ADDING_A_PUZZLE_GAME.md). The turn-game and rated
line-feed mechanisms below remain available independently.

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
  Game-specific engines and boards under `pkgs/` declare `"game"` too;
  a reusable Chess engine remains concrete game code. The workspace graph
  check in `libs/tools-harness-ts/scripts/game-dependency-graph.test.ts` follows both
  production and development dependencies, including cycles and intermediaries.
- Only packages declaring `"gameRegistry": true` compose games, and anything
  depending on a registry is one itself. Today: `@libs/games-shared-ts`,
  `@libs/games-client-ts`, `@libs/game-catalog-shared-ts`, `@libs/games-harness-ts`,
  `@libs/room-app-server-ts`, the runtime packages, the synthetic population
  harness and the apps.

## Who owns what

`GameRules.sides` declares the ordered seats a mode uses — two to four, in
the order `white`, `black`, `red`, `blue` (`assertGameSides`) — and `gameSides`
supplies the two-seat default for existing registrations. Seat tokens are opaque
identities (`white`, `black`, `red`, `blue`); presentation supplies their visible
names. Custom-game readiness, per-seat clocks, bot scheduling, authoritative
ownership, matchmaking group size, synchronization, results and records consume
that declaration. The retained first two stored columns keep existing records
readable; additional seats have their own participants and clocks.

Modes with different seat counts register separate definitions and share their
game's implementation. Each definition has its own id, position recognition
and matchmaking namespace. Every declared seat participates in the shared
roster conformance suite; bilateral specifications apply only to two-seat games,
and the multi-seat specifications cover the wider lifecycle.

| Package | Owns |
| --- | --- |
| `@pkgs/turn-game-shared-ts` | The contracts: opaque `PuzzleContent` rules and optional computations; `GameRules`, `TurnGameCapabilities` and their parts (`GameBots`, `MatchmakingCapability`, `HistoryCapability`, `PuzzlesCapability`), `TurnGames` (lookup by id, position and clock), `GamePresentation`, `GameAutomation`. |
| `@pkgs/turn-game-client-ts` | `TurnGamesProvider` and `useGamePresentation`: the shared screens find a position's presentation. |
| `@libs/spaces-shared-ts` | `GameDefinition` and `GameClientDefinition` (what a space can play), `GameOwnRoom` (a game's own room behaviour), `SharedGameModule`, and the space room that composes them. |
| `@libs/game-session-shared-ts` | `defineGame` for standalone puzzle content; `defineTurnGame`, custom games (sides, people, bots, readiness, clocks, resignation, draws, rematches, offline solo play) and the shared session module installed once per space. |
| `@libs/game-session-client-ts` / `-server` | The custom-game, history and review screens; the matched-game notice, reminder and availability consumers. |
| `@libs/game-matchmaking-shared-ts` / `-client` | Opponent searches, matched games, ratings per speed, rematches, the multiplayer screen and link. |
| `@libs/game-puzzle-shared-ts` | Puzzles over any game's rules: setting a puzzle up, replaying, staging and judging its line (`puzzle-setup`, `opponent-stage`, `solve-projection`, `move-history`, `puzzle-judge`), the space's puzzle session (`PUZZLE_SESSIONS`: its room state, messages, router and handlers, and the puzzle the space reviews), puzzle ratings, completion, statistics, the feed and its settings, choosing the next puzzle, the catalogue and its namespaces (`puzzle-catalogue`, `puzzle-namespace`), the puzzle sub (`GAME_PUZZLE_SUB`: its tables, queries, mutations and erasure) and its server half, and the puzzle link. |
| `@libs/game-puzzle-client-ts` | The client part a game supplies (`GamePuzzlesClient`) and every puzzle screen: play, stats and review, the feed and its settings, the attempt's solver, controls, recorder and result reconciliation, the move list, the puzzle frame (`PuzzleFrame`, `PuzzleSessionEffects`), the puzzle link and the personal stats screen. |
| `@libs/game-menu-client-ts` | `defineGameClient` and the one `GameMenu` every game is offered through. |
| `@libs/game-session-harness-ts` | The conformance contract a game's harness supplies (`PlayableGame` without screens, `HarnessGame` with them, `GameFixtures` and, for a game offering puzzles, its known puzzles: `known-puzzles`), `gameSystem` (a world of any games, with the puzzle sub when a game offers puzzles, and optionally a catalogue holding exactly every game's known puzzles), shared drivers (the platform's puzzle screens as a person uses them, a game's moves on its puzzle board from its known puzzles, and the puzzle session's commands and reads among them), and the laws (`game-rules-laws`, `game-capability-laws`, `game-puzzle-laws`). |
| `@libs/game-matchmaking-harness-ts` | Opponent seeking and the one matched-game scenario world. |
| `@libs/games-harness-ts` | `HARNESS_GAMES`, the conformance matrix, every shared suite and the steps of `specs/games/`. |

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
(`custom-game-state`, `game-state`, the puzzle session's `play-attr` and
`play-result`, the `chess_multiplayer_*` and `chess_puzzle*` tables),
transport and mutation clients (`custom-game-commands`,
`multiplayer-commands`, the puzzle session's `play-messages`, the puzzle
queries and mutations), room and match-room details (`match-room`,
`custom-game-handler`), screen probes (`custom-game-probe`), direct reads
of a device's tables (`multiplayer-reads`), fixture transactions
(`multiplayer-fixtures`), UI controllers, and the registries.

Each framework package declares its public modules in its manifest
(`"gameApi"`, the `src/<module>` files a game may import). A game
package's `lint` refuses any other import from a framework package, in
its source, tests and steps alike, type-only imports included
(`gameApiViolations` in `libs/tools-harness-ts/scripts/package-boundaries.ts`). The
framework's own packages use each other's modules freely. A need the list
cannot meet is a framework change: a focused read, action or fixture
helper in a public module, or a framework test at the framework's owner.
It is never a new entry for an internal module.

| Package | Public modules (`gameApi`) | For |
| --- | --- | --- |
| `@pkgs/turn-game-shared-ts` | `game-rules` | `GameRules` (with its optional private setup, `PrivateSetupRules` and `GameSetups`), `TurnGameCapabilities` and each capability's contract (`GameBots`, `MatchmakingCapability`, `GameNoticeText`, `HistoryCapability`, `GameRecordMetadata`), `GameSide`, and `createTurnGames` for a game's own suites |
| | `game-puzzles` | `PuzzlesCapability`, `PuzzleRecord`, `PuzzleMarks`: what a game supplies to be offered puzzles |
| | `game-presentation` | `GamePresentation`, `GameBoardProps` (with the viewer's own `setup`), `GameSetupBoardProps`: the board, the setup board of a game with private setups and the copy the shared screens show |
| | `game-automation` | `GameAutomation`: a synthetic or scripted participant's choice, its board gesture and, for a game with private setups, the gesture that arranges a setup (`arrange`) |
| `@libs/game-session-shared-ts` | `turn-game-definition` | `defineTurnGame` and `TurnGame`: the registration |
| `@libs/game-menu-client-ts` | `game-client` | `defineGameClient`, `GameClient` (its `shared` registration and, for a game offering puzzles, its `puzzles` part), `GameClientPresentation`, the game's own screens and choices |
| `@libs/spaces-shared-ts` | `game` | `GameOwnRoom`, `GameCommandContext`: a game's own room behaviour, and `mergeGameRouterEntries` (one router per namespace, as the space composes a shared module and a game's own room) for a game's room tests |
| `@libs/game-session-harness-ts` | `harness-game` | `PlayableGame`, `HarnessGame`, `GameFixtures`, `ReadGameRecord`, `PuzzleSoundKind`, `assertHarnessGame`: the conformance adapter (a game offering puzzles names the sounds its puzzles play, `puzzleSounds`) |
| | `known-puzzles` | `PuzzleFixture`, `PuzzleFixtureMove`, `KnownPuzzles`: the known puzzles of a game offering puzzles, and its more puzzles (`morePuzzles`) for a scenario needing many at once |
| | `game-system` | `gameSystem`, `openGameHarness`: a world of any games |
| | `game-navigation`, `space-game-choice` | Choosing a game in a space and moving between its screens |
| | `custom-game-ui`, `custom-game-controls`, `custom-game-lineup` | Making Custom Game choices as a person does (`CustomGameAction`): one choice, the screen's controls, a whole lineup |
| | `custom-game-moves` | The shared board (`CUSTOM_GAME_BOARD`), `makeCustomGameMove`, `customGameBoardTakes`, `playOnCustomGameBoard` (the game's own gesture, then the product's answer) |
| | `custom-game-screen`, `custom-game-reads` | What a person's Custom Game screen shows: a projection of the game, the refusal they were told, their clock, invitations, the move list |
| | `custom-game-history` | Fixture: a legal earlier history played through the real move boundary |
| | `puzzle-session-probe`, `puzzle-fixtures` | The space's puzzle session below the screens: a command as a (possibly modified) client sends it and what the session holds; the rating scale, the rated start key and the rated-result write a quota table replays |
| | `puzzle-screen`, `puzzle-records` | The platform's puzzle screens as a person uses them, for any game: the way in and back, the attempt's controls, what the board and its probes say, the rating change, the puzzle stats (in the space, or a person's own from Settings), the game log and a played puzzle's review; retiring a catalogue puzzle |
| | `puzzle-feed`, `puzzle-feed-choices` | The feed settings as a person customizes them, for any game: the history filter, target mode, rating offset and custom target, the game's themes (as the game names them) and auto-advance, saved, discarded or closed, and what the feed bar and the settings say; the feed choices `puzzle-feed.qnt` names, and "a theme of the game's known puzzle" (`chosenFeedTheme`) |
| | `puzzle-pool` | A pool a scenario describes (rating, popularity, times played, themes) made of the game's known puzzles (or its more puzzles) and written through `admitCataloguePuzzle`; what the catalogue says of a puzzle; a person's earlier puzzle rating at a game (`seedPuzzleRating`) |
| | `puzzle-allowance` | The daily puzzle limit as a scenario sets it up, one allowance for every game: the rated starts a device has charged, earlier starts of the same day written to the one ledger, and the night passing to the next UTC day |
| | `puzzle-moves`, `puzzle-room-probe` | Moves on a puzzle board with the game's own gesture, chosen from its known puzzles (the line, the wrong, refused and opponent's moves, a win off the line); a puzzle command sent straight to the space's room, as a modified client would |
| | `puzzle-finishes`, `puzzle-result-recovery` | Finishing a puzzle every way a solver can (cleanly, after a hint, a wrong move retried, the shown solution, a skip), as the app closes, on two devices of one account apart, won both ways, and day after day; closing and reopening the app, and the first result each device's stats show, judged by an independent Glicko-2 update from the known puzzle's rating |
| | `puzzle-link`, `puzzle-listening`, `puzzle-sounds` | Sharing and opening a puzzle link, and what its screen says; the puzzle controls from the keyboard alone and what someone listening hears of the results; the puzzle sounds a device actually played, as the game names them |
| `@libs/game-matchmaking-harness-ts` | `matched-game-world`, `matched-game-app.steps` | The scenario's matched game: pairing, both boards, commands and verdicts, the game a device holds (`heldMatchedGame`) |
| | `opponent-seeking`, `multiplayer-board`, `multiplayer-review`, `multiplayer-game-record` | Finding an opponent, the board (`sendMoveFromBoard`), reviewing earlier positions, copying the game record, as a person does |
| | `multiplayer-time`, `matched-game-fixtures` | Fixtures: time passing through the real sweep; a position or a clock set where no person could reach it in time |
| `@libs/game-puzzle-shared-ts` | `puzzle-catalogue` | `admitCataloguePuzzle`, `CataloguePuzzle`, `CatalogueRow`, `insertNewCatalogueRows` / `upsertCatalogueRows` and the catalogue topic: a game's import pipeline writes its puzzles only through it |
| | `sub` | `GAME_PUZZLE_SUB` (its tables, topics, reads and writes) and `gamePuzzleSubs`: what a game's import pipeline and its own tests compose beside their own tables |
| | `puzzle-link` | The puzzle link's route, path and parsing |
| | `completion`, `hint-stage`, `solve-status` | The attempt's vocabulary its `PuzzleAttempt` speaks: a completion and its rating change, the hint's stage, the solve status |
| `@libs/game-puzzle-client-ts` | `puzzle-client` | `GamePuzzlesClient`, `PuzzleBoardProps`, `PuzzleBoardMarks`, `PuzzleSuggestion`, `PuzzleAttempt`, `PuzzleCoachLine`, `PuzzleFeedback`: the client part a game offering puzzles supplies |
| | Personal puzzle stats | Framework-owned: composition derives each registered puzzle game's settings entry and `/more/<game id>-stats` route; no game-owned wrapper or additional public game API |
| `@pkgs/turn-game-client-ts`, `@libs/game-session-client-ts`, `@libs/game-session-server-ts`, `@libs/game-matchmaking-shared-ts`, `@libs/game-matchmaking-client-ts` | none | The platform's screens, consumers, commands and storage: a game never imports them |
| `@libs/games-shared-ts`, `@libs/games-client-ts`, `@libs/game-catalog-shared-ts`, `@libs/games-harness-ts` | none | Registries: composition roots import `game-plugins`, `game-plugins.client`, `turn-games` / `game-automations` and `harness-games` / `game-conformance`; a game never depends on one (`gameViolations`) |

Matched-game reads keep the record's durable field names (`fen`, `pgn`,
`white_id`, … — see [Durable names](#durable-names)): a game reads the
values the world returns but never imports their stored type.

## The lifecycle of a registered game

1. **Definition.** `defineTurnGame({ rules, capabilities, automation, own? })`
   in the game's `-shared` package validates the game when its module loads
   and returns the only value the registry accepts: a `TurnGameDefinition`,
   an instance carrying a private brand that a spread copy or a hand-built
   object lacks, so either is refused at type checking; it carries its
   capabilities' type. `defineGameClient` does the same for the client
   (`GameClientRegistration`): the client names its shared registration
   (`shared`, which gives its id), and its parts follow what that
   registration offers — a `puzzles` part exactly when it offers puzzles, a
   type error otherwise and a refusal when the module loads. Neither needs a
   cast.
2. **Registration.** One entry in `GAME_DEFINITIONS`, one in
   `GAME_CLIENT_DEFINITIONS` (client bundles only), one in `HARNESS_GAMES`
   (tests only). Each registry checks, when it loads, that every entry was
   made by its constructor (`assertTurnGameDefinitions`,
   `assertGameClientDefinitions`, and `assertHarnessGame` for an adapter's
   two); the client registry agrees with the turn games entry for entry
   (`assertMatchingGameIds`, naming the entry to add, remove or reorder, and
   a client whose `puzzles` part disagrees with what its game offers, as
   `assertHarnessGame` does for an adapter);
   the harness games agree with the registry (the conformance plan,
   below).
3. **Composition.** The registries are the single source of what is played:
   - the space room (`composeRoomModules`) installs each game's own room and,
     once, every shared module bound to all registered rules (a shared
     module and a game's own room may share a durable message namespace:
     the space merges their routers, refusing a message both handle);
   - the puzzle sub and its server half join the app exactly when a game
     offers puzzles (`gamePuzzleSubs`, `gamePuzzleServers`, and the
     `game-puzzle` harness slice in `gameSystem`), as does the puzzle link;
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

`GameRules` is what every lifecycle needs from an ordered turn game: `id`,
`recognizes` (exactly this game's positions), `initial`, `play` (the next
position, or `null` when refused), `replay`, `legal`, `canWin` (a flag fall
against a side that cannot be beaten is a draw) and `moves` (the accepted
actions, labelled). The sides take turns: the first side moves first and
every action passes the turn to the next declared seat (`PlayedPosition.turn`), as
`specs/games/game-turns.feature` says of every game; a rules law holds
each game to it. The rules name the result (`PlayedPosition.winner`), which
need not be the side that moved.

Capabilities are present or absent, each with what it needs:

| Capability | The platform offers | The game supplies |
| --- | --- | --- |
| `custom-games` | Custom games with people and bots, invitations, readiness, clocks, resignation, draws, rematches, offline solo play, review | `bots: { difficulties, choose }` (no difficulties = one bot) |
| `matchmaking` | Finding an opponent at a clock choice, matched games, ratings per speed, turn and result notices, rematches, the multiplayer link | `clockNamespace` (`'<id>/'`), `notice` copy for server-sent notices; **requires `history`** |
| `history` | History, statistics and review of finished games; the downloadable record | `record(position, history, metadata)` |
| `puzzles` | Puzzles from the game's positions: the catalogue in the game's own namespace, the next puzzle, setting it up, judging each move, hints, the solution, ratings and feed settings per game, statistics and review, watchers' suggestions, the puzzle link, and the Puzzle and Puzzle stats screens | Shared: `namespace` (`'<id>/'`), `content.validate(record)` (and optionally `content.positionKey`), optionally `judge.canonical(position, action)` and `judge.samePosition(a, b)`, `marks(position, action)` (the cells a hint or a wrong move shows) and `isCell(cell)`. Client (`defineGameClient({ puzzles })`): `Board` (`GameBoardProps` plus size, play or review mode, marks and suggestions), optionally `coach(attempt)`, a `Companion`, feed `themes`, move `notation` (choices, the first the default; how a move is written and numbered) and `useFeedback` (sounds, haptics); **requires nothing else** |

A game never supplies a placeholder for a capability it does not offer, and
the platform shows, accepts and tests nothing for an absent one.

**Private setups** are part of the rules, not a capability: a game whose
sides prepare something in secret before play (Battleship's fleet) supplies
`GameRules.setup` — `accept(setup)` (the setup as stored, or `null` unless
complete and legal), `random(random)` (a complete legal setup) and
`resolve(position, proposal, setups)` (the public action a proposal resolves
to with both setups) — its presentation's `SetupBoard`, its automation's
`arrange` gesture and, in its harness, one known setup per side
(`fixtures.setups`). Every capability it offers then follows
[Private setups](#private-setups-gamerulessetup). A game with private setups
offers no puzzles (`createTurnGames` refuses the pair: a puzzle shows its
whole position to the solver).

**Dealt hands** are part of the rules too: a game whose authority deals
hidden information as it starts and keeps it as play goes on (Word Tiles'
bag and racks) supplies `GameRules.hands` — `deal(position, random)` (the
hidden state), `hand(hidden, side)` (all one side may know of it),
`resolve(position, proposal, hidden)` (the public action and next hidden
state, or a refusal) and `proposals(position, hand)` (some proposals a hand
allows) — and, in its harness, one known deal (`fixtures.knownDeal`). Every
capability it offers then follows
[Dealt hands](#dealt-hands-gameruleshands). A game deals hands or has private
setups, not both, and offers no rated puzzle feed; it may offer authored
puzzle content (`puzzleContent`).

**Immutable rule data** a game decides with (a word list) loads through
`GameRules.prepare`, once per process. The platform awaits
`prepareTurnGames` before a room authority restores, before the API server
and migrations start, and before a device decides alone; a decision that
needs data that has not loaded throws, so it fails without effect and is
retried.

Finding an opponent requires history: every finished matched game offers
its game record (`specs/games/matched-game-record.feature`), which only
`history.record` writes. `TurnGameCapabilities` makes `matchmaking`
without `history` a type error, and `createTurnGames` (so `defineTurnGame`)
refuses it for what a type cannot see: `<id>: offering matchmaking needs
history too (every finished matched game offers its game record) — add
capabilities.history`. The requirement is `CAPABILITY_REQUIRES`. History
alone, without matched games, is custom-game history, statistics and
review; its record is never copied.

Client extension points (`defineGameClient`): `shared` (the game's
`defineTurnGame` value: its id, and which parts are asked for),
`presentation` (board, side names, ending copy), `puzzles` (exactly for a
game offering puzzles), optional `choices` and `screens` (the game's own
screens, shown space-wide), `settings`, `Frame` (data its own screens
share) and `SessionEffects`. The platform wraps a puzzle-offering game's
frame in its puzzle frame (the feed, a puzzle link) and adds its puzzle
session effects (result reconciliation). The screen keys `puzzle`,
`stats` and `stats-review` are the platform's, like `custom-game`,
`multiplayer`, `history` and `settings`. A game screen navigates with
`useGameScreen()`; it never renders the platform's screens itself.

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
  absence), all in `@libs/game-session-shared-ts`. Matched games:
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
- **Result.** A move's `winner` is the result every lifecycle records:
  `playCustomGameMove` (`<winner> wins by <reason>`), `playMultiplayerMove`
  (`outcome`) and `judgePuzzleAction` (the solver's win). A move may lose
  for its mover (regression `custom-game-mover-credited-win`).
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

### Private setups: `GameRules.setup`

The one rule underneath: **every position stays public**. A setup is held
only by its side and the authority; the authority resolves each proposed
action with both setups into the public action it records (`e5` becomes
`e5:hit`), so `play`, `replay`, `moves`, move lists, history, records,
review and every watcher's copy work on public positions and actions alone,
exactly as for every other game. `legal`, bots and automation propose from
the public position, which holds no setup — a bot cannot see the opponent's
setup because it is never given it.

- **Room privacy (generic).** A room module may name who reads an event
  (`RoomModule.audience`). The server withholds a private event from every
  other connection before it is serialized — on commit, on a welcome or
  catch-up from any point, and on a retried command's replay — sending
  `RoomEventWithheld` at the same sequence number, so every log stays
  contiguous and no copy, persisted or not, holds what its reader may not.
  A commit without a private event still reaches every reader as one frame
  (`pkgs/room-root-harness-ts/tests/private-events.contract.test.ts`).
- **Custom games.** A person's setup travels with their readiness (`ready`
  with `setup`, which must be complete) as an event only they read; it
  cannot change while they are ready, and withdrawing readiness unlocks it.
  The room draws a bot's setup when the game starts, read by nobody. Handlers
  learn whether they decide as the room (`GameCommandContext.authority`): a
  device predicting its own move checks it against the public position and
  predicts no outcome, so nothing secret-dependent is ever shown before the
  room answers, and a move made without a connection waits. Such a game is
  never played on the host's device alone (`soloCustomGame` needs every
  position public), so a bot's setup never reaches a device. A rematch is a
  new game id with no setups. The custom-game module has an audience only
  when some registered game has private setups, so other rooms are unchanged
  (`custom-game-private-play.ts`, `custom-game-setup.ts`).
- **Matched games.** After pairing a game is set up: each person chooses
  their setup once (`chooseMultiplayerSetup`, the play permission), stored in
  `chess_multiplayer_setups`, which syncs only to its owner, whose topic map
  wakes only them and never sends the row as an image (the server fanout now
  honours `rowImage.publish`: a batch with such a row sends no images, so
  every reader reads again through its own authorized queries). The game row
  shows only which sides are ready (`setup_ready`, also in the match room,
  where readiness never goes back). Both sides have `SETUP_MS` (2 minutes; a
  daily game its days) or the game is aborted (`setup missed`, no result, no
  rating); the first side's first-move wait starts when both are ready.
  Moves are resolved under both people's owner lock with both setups. Daily
  turn notices wait for the setups; a deleted account's setups are erased; an
  export holds only the person's own (`multiplayer-setup.ts`).
- **Screens.** The custom-game and matched-game screens show the game's
  `SetupBoard` for the person's own setup (locked while ready or offline),
  a random setup and whether it is complete; readiness is public. Every
  board and the history review receive only the viewer's own setup
  (`GameBoardProps.setup`).
- **Observability.** `chess.setup.chosen` names which sides are ready, never
  a setup; the server stores no mutation arguments in its events.
- **Proof.** The private-setup laws (`game-rules-laws.ts`: random setups
  complete, every offered proposal and nothing else resolves, no position or
  label spells a setup) and the faulty consumers proving them
  (`reference-game/faulty-private-setups.test.ts`); every shared law plays a
  private-setup game as its authority does (`played-rules.ts`); the privacy
  suites reading what leaves the platform — room history sent to each
  connection, every row each device holds, and noninterference across worlds
  differing only in the other side's setup
  (`conformance/custom-games/private-setup-privacy.test.ts`,
  `conformance/matchmaking/private-setup-privacy.test.ts`); the shared
  specifications `custom-game-private-setup.feature`,
  `matched-game-private-setup.feature` and `private-setup.qnt`; and
  `game-session-shared/tests/private-setup.test.ts`,
  `game-matchmaking-shared/tests/private-setup.test.ts`. The test-only
  consumer secret pick (`reference-game/secret-pick-game.tsx`) holds every
  one of them beside Battleship.

### Dealt hands: `GameRules.hands`

The same rule as private setups: **every position stays public**. The
hidden state (a bag's order and each side's hand) is one opaque string only
the authority holds. It is dealt once, with the authority's random, when the
game starts; each side is shown `hand(hidden, side)` after every action; and
the authority resolves each proposal with the hidden state into the public
action it records (`play:h8=12.i8=98E` becomes `play:h8C.i8e`: the letters, never which tiles), so
`play`, `replay`, `moves`, records, review and every watcher's copy work on
public positions and actions alone. A refusal changes nothing; its reason
is the game's own (`follow suit`), told only to the side that proposed it
and worded by `GamePresentation.refusalDescription(reason, position)`. Bots choose from the public position and their
own side's hand (`GameBots.choose(…, hand)`, `GameAutomation.choose(…,
hand)`); they are never given another side's.

- **Custom games.** When the game starts the room deals the hidden state as
  an event nobody reads (`hidden-dealt`) and shows each person their hand as
  an event only they read (`hand-shown`; a bot's is read by nobody), again
  after every action. With another person at the table, devices predict
  nothing and only the room moves a bot (a creator's chosen bot move is
  refused), so no hidden state reaches a device
  (`custom-game-hands.ts`, `custom-game-hand-play.ts`).
- **Practice against bots.** A game whose only person is its creator is
  solo, also offline: the creator's device draws the deal's numbers once and
  sends them with the start (`ChangeLocalCustomGame.draws`, accepted only for
  a solo game), so the device and the room deal the same hidden state; the
  creator alone also reads the hidden state and the bots' hands (`reader`),
  so the device resolves moves and pre-chooses the bots' proposals as the
  room does. A watcher still receives none of it
  (`custom-game-router.ts`, `custom-game-local.ts`).
- **Matched games.** The server deals at creation, each draw from a fresh
  server-side identity (`drawsFromIds`), and keeps the hidden state in
  `chess_multiplayer_hidden`, which never syncs; each person's hand is a row
  of `chess_multiplayer_hands` that syncs only to its owner and is never sent
  as a row image. Moves are resolved on the server under the owner lock;
  a deleted account's hands are erased and an export holds only the
  person's own (`multiplayer-hands.ts`).
- **Screens.** Every board and the history review receive only the viewer's
  own hand (`GameBoardProps.hand`, `null` for a watcher).
- **Randomness.** A deal must not be recoverable from what a side sees: Word
  Tiles keeps a 128-bit seed and a xoshiro128** state in the hidden state,
  not a 32-bit seed a player could search for.
- **Proof.** The dealt-hands laws (`game-rules-laws.ts`: every offered
  proposal resolves, refusals change nothing, no position or label spells
  another side's hand); every shared law plays a dealt-hands game as its
  authority does, on composite positions `public`, `hidden` and turn
  (`played-rules.ts`, with `fixtures.knownDeal` and a scripted random); room
  draws a scenario fixes (`room-draws.ts`: `dealKnownHandsOnStart`); and the
  privacy suites reading what leaves the platform
  (`conformance/custom-games/dealt-hands-privacy.test.ts`,
  `conformance/matchmaking/dealt-hands-privacy.test.ts`). Conformance traits
  `dealt hands` and `four seats` route the shared features that need them.

### Secret choices: `GameRules.hands.commit`

A phase in which several sides choose at once, each in private (Hearts'
three-card pass). `commit.sides(position)` names who chooses now;
`accept(position, side, hand, commitment)` judges one side's choice from
its own hand alone (`{commitment}` or `{refusal}`); once every side has
chosen, `resolve(position, commitments, hidden)` turns them into one public
action and the new hidden state. No choice is a public turn and no
cryptography is involved: the authority alone holds them.

- **Custom games.** Each choice is a room event read only by its person
  (`commitment-chosen`, `custom-game-commitments.ts`); everyone sees only
  which sides have chosen (`GameBoardProps.committed`, the side badges and
  status line), and a person sees their own choice
  (`GameBoardProps.commitment`) until the last one resolves the phase
  (`custom-game-commit-play.ts`). A choice may be changed until then;
  clocks do not run while sides choose. Bots choose from their own hand.
  In solo practice the creator's device decides as the room does, reading
  the bots' choices (`reader`), as with dealt hands.
- **Matchmaking.** Not offered: `defineGame` refuses a matched game with
  `hands.commit`.
- **Proof.** The laws and the played rules treat a whole phase as one
  combined proposal (`commit:a|b|c|d`, `played-rules.ts`), so every shared
  law plays it as the authority does; `specs/games/secret-choices.feature`
  and the reduced model `secret-choices.qnt` (trait `secret choices`).

### Turns the rules decide: `GameRules.turnOrder`

`'rotation'` (the default) holds a game to seats taking turns in order.
`'rules'` lets the rules name the next side (`PlayedPosition.turn`), as a
trick's winner leads the next trick; the alternation law and the
specifications needing `rotating turns` then do not bind the game.
Matchmaking still assumes rotation (its abort window, clock start and move
numbering), so `defineGame` refuses a matched game with `turnOrder: 'rules'`.

### Joint winners: `GameWinner`

A result is one side, `'draw'`, or several sides (`readonly GameSide[]`).
`plainWinner` puts it in its plainest form — every seat is a draw, one seat
that seat — and `winningSides` lists who it goes to. A custom game stores
`white and red win by <reason>` (`customGameOutcome`,
`custom-game-outcome.ts`) and credits each winner in its status, records
and history (`specs/games/shared-victories.feature`, trait
`a shared victory`). A matched game records one winner or a draw: its
ratings compare a win, a loss or a draw.

### Stand-ins

In a custom game of more than two sides, a person away for
`CUSTOM_GAME_STAND_IN_MS` (the away grace period) is replaced by a
disclosed stand-in bot that plays their seat with their own hand; the side
shows it (`custom-game-<side>-stand-in`) and the person takes the seat back
with a choice of their own (`reclaim`, `custom-game-reclaim`). Only one
controller acts for a seat: the person's moves are refused while a stand-in
plays (`a stand-in plays your side`), and a stand-in's wake is stale once
the seat is taken back. Stand-ins end with the game
(`custom-game-stand-in.ts`, `specs/games/multi-seat-stand-ins.feature`).

### Long custom games

A game of hundreds of actions (a Hearts match) keeps the room log and the
screens linear: an appended move is recorded as one `progressed` event
rather than the whole game again (`custom-game-progress.ts`), a played
position is verified once and remembered (`rememberCustomGamePosition`),
parsed state is cached by identity, and the move list shows the latest 40
moves, numbered from where they start.

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

`useGameRecords` (`@libs/game-session-client-ts`) lists the space's
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

### `puzzles`: the catalogue, the session, completion and results

- **Callers.** The space's puzzle session (`PUZZLE_SESSIONS`, installed
  once by `gameModules` for the games declaring `capabilities.puzzles`,
  `defineTurnGame` adding it to the game's shared modules), the
  platform's puzzle screens (`@libs/game-puzzle-client-ts`: the opponent
  stager, the review board and the move list replay the line through
  `positionAt` / `playPuzzleAction`), and the catalogue writer. The
  session finds a puzzle's game by its position (`TurnGames.forPosition`):
  a position no game recognises starts an `invalid` puzzle; one whose game
  offers no puzzles is refused. The screens find it by the game they are
  shown for (`PuzzleGameProvider`).
- **The catalogue.** One table of every game's puzzles, each game in its
  own namespace: a puzzle id is `<namespace><local id>` (chess's namespace
  is `''`, and Lichess ids contain no `/`). `admitCataloguePuzzle`
  (`puzzle-catalogue`) admits a puzzle only into the namespace of the
  registered game offering puzzles there, only if that game recognises
  its position and its `content.validate` accepts it, and keys
  duplicates by its `content.positionKey`; only an admitted `CatalogueRow`
  is written (`insertNewCatalogueRows`, `upsertCatalogueRows`). Chess's
  Lichess pipeline writes through it. Every read filters by namespace
  (`puzzleNamespaceCondition`: `NOT LIKE '%/%'` for `''`, a `LIKE` prefix
  otherwise — the same in SQLite and Postgres; a namespace holds no
  wildcard; readers filter rows a rating index already narrowed, so no
  index of its own): the pool and nearest reads take an optional
  `namespace` (`''` when left out), and so do the device's picks and
  counts and a person's rating events and interactions. A person's rating
  profile and feed settings are kept per game (`<namespace><owner id>`;
  chess's are the owner id itself).
- **Inputs.** A puzzle's position and line come from the catalogue; a
  solver's action is shape-checked only (no whitespace, at most 64
  characters), and `rules.play` alone decides whether it is a move. A
  suggestion's two cells must satisfy `isCell` (the screens send the cells
  `marks` names for a watcher's move; one cell names both ends).
- **Compute only.** `setupPuzzle` plays `line[0]`; the solver is the side
  whose turn it gives (`PlayedPosition.turn`). `judgePuzzleAction`: a
  move `play` refuses is illegal; one whose result is the solver's win
  solves the puzzle; one equal to the line's move after
  `judge.canonical` follows the line; the solver's following line move
  played one turn early transposes when `judge.samePosition` (string
  equality by default) says both orders meet; anything else is wrong.
  Each action is played from the puzzle's position with no earlier
  history. A hint and a wrong move show `marks`; a move's spoken and
  listed label is `PlayedPosition.label`. The room commits the verdict's
  events; a game function — rules, capability or client part — never
  writes.
- **Completion.** The room decides an attempt's result once: the move
  that solves it, the wrong move, a shown solution or a skip ends it and
  records the result's owner, attempt key, outcome and score
  (`PuzzleResultAttr`, set by `play-reducer` from the router's events). The owner's device records it
  (`ReconcilePuzzleResult`, mounted by `PuzzleSessionEffects` for the
  whole space session of each game offering puzzles, for that game's
  namespace): the interaction (`appendPuzzleInteraction`) and the rated
  result (`ratePuzzleAttempt`), which derives the new rating inside the
  mutation from the stored profile.
- **Duplicate completion.** A result is recorded at most once and rates at
  most once: the rating ledger row is keyed `<owner>|<puzzle>`, so a second
  attempt, a duplicated upload or a replay finds it and leaves the rating
  alone; the result's interaction is keyed `<owner>|<attempt key>`, and a
  different first result for the same attempt is refused
  (`CHESS_ATTEMPT_ALREADY_FINISHED`, in `ratePuzzleAttempt`); the
  recorder (`usePuzzleResultRecorder`) keeps the attempts it
  finished; two results read under one profile retry rather than lose a
  rating (the conditional profile update).
- **Offline result sync.** Both writes are mutations: they apply to the
  device's database at once and replay on the server when it is back, as
  the same idempotent definitions. A rated result needs the rated start
  it was charged for (`requireChargedInMutation` with the rated start
  key), so a device that skipped the start cannot record past the daily
  limit; an interrupted rating write is finished on restore (the
  recorder retries until it lands).
- **Durable names.** The session's room attributes (`chess.puzzle.play/*`,
  `chess.puzzle.result/*`, the review's `chess.main-menu.selected-review-*`),
  its message namespaces (`chess-puzzle-play-cmd`, `chess-puzzle-play-evt`,
  and the review's `chess-cmd` / `chess-evt` messages) and payload keys
  (`fen`, `moves`, `displayFen`, `uci`, `san`, `wrongToSquare`,
  `fromSquare`, `toSquare`, `orientation`), the `chess_puzzle*` tables in
  domain `GAME_PLATFORM_NAMESPACE`, the query and mutation names, the
  catalogue topic `system:chess_puzzles`, the route
  `/chess/puzzle/:puzzleId`, the screen keys and handles (`puzzle`,
  `stats`, `stats-review`, `game-choice-puzzle`), the device's attempt
  memory key (`chess.puzzle.attempt.*`), the telemetry events
  (`chess.puzzle.attempted` / `completed`) and every stored id
  (unprefixed for chess) are unchanged. A feed's stored notation is the
  game's own key; `''` (the default stored now) reads as the game's first,
  and a stored `'san'` stays chess's SAN.
- **Proof.** Per game offering puzzles, on its known puzzles
  (`fixtures.puzzles`), in `@libs/games-harness-ts/tests/conformance/puzzles/`:
  `puzzle-content` (its own namespace and content, every other game's
  known puzzle refused by its validation, recognised by it alone, admitted
  into its namespace alone, duplicates by key), `puzzle-judge` (the
  solution follows the line and solves on its last move, the wrong move is
  wrong, the refused move no move, every legal move judged; a win off the
  line and a transposition where its puzzles show them), `puzzle-playback`
  (the line replays as its rules play it; hints, wrong moves and
  suggestions name cells) — the laws of `game-puzzle-laws` — and
  `puzzle-catalogue` (written beside every other game's, read by the pool,
  nearest read and next pick of its namespace alone), `puzzle-session`
  (start, setup refusals, submit, wrong and refused moves, hints, retry,
  clear, reclaim, stepping, watchers; regression
  `puzzle-solved-review-resumes`), `puzzle-completion` (the clock, skip,
  the shown solution, the result decided once — a late or repeated move,
  a skip or the solution after it change nothing — the traits in the room;
  regression `puzzle-attempt-clock-identity-collision`), `puzzle-results`
  (a result uploaded again and again rates once in its game's profile, as
  on the device; a later attempt leaves the rating alone; an attempt keeps
  its first result) and `puzzle-board` (the game's automation plays each
  solution move on its puzzle board, which shows each mark, takes no move
  in review, and every line move has words in each notation). Faulty
  copies of the reference game (`reference-game/faulty-games`) are refused
  by the law they break, and `reference-game/known-puzzles-contract` holds
  the fixture obligation. Beside them: `game-puzzle-shared/tests`:
  `puzzle-judge` and `opponent-stager`
  (a game the platform knows nothing about), `puzzle-catalogue` (admission,
  the namespaced reads on SQLite and Mockingbird Postgres, the per-game
  profile and feed settings, beside a second game in `pile/`), `step` (the
  line's indices), `rate-puzzle-attempt` and `puzzle-profile-query`
  (regressions `puzzle-inconsistent-result-score`,
  `puzzle-profile-volatility-sync`);
  `games-harness/tests/chess-puzzles` (a mate ends a chess puzzle whatever
  its stored line says, against chess.js);
  `chess-puzzle-shared/tests/canonical-spelling` (chess's castling and
  promotion spelling);
  `games-harness/tests/rated-puzzle-quota` (`rated-puzzle-quota-bypass`);
  `game-puzzle-client/tests/interrupted-outcome`
  (`puzzle-outcome-recorded-rating-lost`,
  `puzzle-result-queued-without-rating`);
  `chess-root-server/tests/rating-concurrency`
  (`puzzle-concurrent-results-lost-rating`);
  `chess-puzzle-server/tests/puzzle-import-batch` (a Lichess row stored
  exactly as chess validated it); `game-menu-client/tests/game-client-contract`
  and `games-shared/tests/game-plugin-contract` (the puzzles part);
  `chess-puzzle-harness/tests/puzzle-session-compatibility` (a chess
  puzzle room recorded before the capability replays to the same events,
  refusals and state); the shared puzzle specifications, run for every game
  offering puzzles on its known puzzles (`specs/games/puzzle-play`,
  `solve-flow`, `solve-move-rules`, `solve-show-solution`,
  `puzzle-controls`, `puzzle-attempt-resume`, `puzzle-review`,
  `puzzle-skip-clock` and `puzzle-attempt.qnt`); and chess's own
  (`specs/chess/puzzle-*.feature`, `puzzle-outcome-sync.feature`,
  `puzzle-offline*.feature`, `puzzle-interruption-recovery.feature`,
  `puzzle-assistant.qnt`, `puzzle-result-recovery.qnt`).

### Not yet proven by a test

These hold by construction today, but no test pins them yet:

- A redelivered result notice stays dismissed. The consumer sends it
  without `resurface`, and `publishNotification` in
  `@libs/notifications-server-ts` keeps a dismissal unless asked to
  resurface it.
- A bot whose proposal is refused leaves its game waiting for the next
  wake or a clock: no new bot wake is scheduled. The bot law refuses such
  a bot before it ships.
- A presentation is a pure function of what it is given.

## Conformance

Every registered game, and the test-only reference game
(`libs/games-harness-ts/tests/reference-game/`), is held to the shared
behaviour for exactly what it offers:

- **Shared specifications.** `specs/games/*.feature` run once per game
  offering everything a feature shows (`SHARED_SPECIFICATIONS` in
  `@libs/games-harness-ts/game-conformance`). A feature may also need a trait
  of the game's rules that not every game has (`GAME_TRAITS`: a side that
  cannot win, a draw by the game's own rules, a known puzzle won another
  way); a game has it exactly when its fixtures show it
  (`secondSideCannotWin`, `drawByRules`, a known puzzle's `wonAnotherWay`),
  and a game without the fixture is held by the rules laws to never reach
  such a position (or, for puzzles, to win each known puzzle only by its
  line). A feature showing more than one capability holds for the games
  offering all of them (`puzzle-matched-play`: puzzles and finding an
  opponent; `puzzle-custom-play`: puzzles and custom games). The moves played and a copied game record are checked against
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
  `@libs/games-harness-ts` runs once per game its area binds (`rules`: every
  game; otherwise the capability of that name), as `<game> › <area> › <suite>`.
  The rules laws are property tests (`assertProperty`): positions name one
  game, replay reproduces every position, the moves shown are the moves
  played, only legal actions are accepted, the sides take turns, and
  automation and bots choose legally. The capability laws
  (`game-capability-laws`) hold every game's
  presentation to naming the game and each side apart, describing and
  labelling every ending its rules reach, and describing a draw on time
  (`conformance/rules/presentation`), and every game whose matched games
  offer a record to writing both people on their sides, the result, the
  clock choice and this game's moves, as its `readRecord` reads them
  (`conformance/history/game-record`). A suite registers its tests inside
  `forEveryGame`. A suite needing more than its directory's capability
  names those requirements as its third argument: for example, a copied
  game record needs `['matchmaking']` beside `history`. Every game meeting
  those requirements must register a case of its own.
  The package's `test:contract:0` through `:4` run rules, custom games,
  matchmaking, history and puzzles respectively. `test` owns the ordinary
  checks and matrix; `test:contract` owns the isolated composition. The full
  gate enumerates all parts, with the same task budgets as other packages.
- **Independent oracles.** Expected outcomes come from each game's
  `fixtures` — a known first-side victory, known refused openings and, for
  a game that has one, a known line to a position its second side cannot
  win; for a game offering puzzles, its known puzzles (each with its
  solver, solution, every line move's label, a wrong move and a refused
  move, and a win off the line or a transposition where its puzzles have
  one) — written from the game's own laws, or from the contract, never from
  asking the implementation whether it agrees with itself: the positions a
  puzzle's line reaches are asked of the game's rules alone, never of the
  platform's puzzle engine, and `assertHarnessGame` refuses known puzzles
  the rules contradict. Faulty copies of the
  reference game (`reference-game/faulty-*.test.ts`), each defined through
  `defineTurnGame` and `defineGameClient` like any game, prove each law
  refuses the fault it names — and only that law, for that reason: rules,
  bots, automation, a strength offered twice, endings and side names lost,
  a record with the wrong people, result or game, a puzzle spelling that
  misjudges the solution, marks off the board, a puzzle validation
  accepting another game's puzzle, a puzzle namespace taken from another
  game, and known puzzles the rules contradict.
- **The matrix.** `tests/game-conformance-matrix.test.ts` derives the
  game × area matrix from offered capabilities and the suites that require
  a case of each game, prints it, and fails on every problem
  `planConformance` (`@libs/games-harness-ts/game-conformance`) finds, each
  saying what to fix: a game in `GAME_DEFINITIONS` but not `HARNESS_GAMES`
  or the reverse, out of order or with another definition; a code suite
  missing a case for any eligible game, claiming a case for an ineligible
  game, registering no cases, or never calling
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
  Agreement between the registries is insufficient: each harness game
  must also appear in the execution world with its registered definition.
  Duplicate execution ids and labels fail rather than sharing evidence.
- **Isolated composition.** The package's `test:contract` installs only the
  setup-race and counting reference consumers at the normal registry
  boundaries and rejects loading any production game source. Every shared
  code suite, the reference falsification cases, the matrix and the
  canonical custom-game and turn features execute in that composition.
  An attempted hidden concrete import must fail. The core shared package
  separately bundles and executes empty composition and its counting
  consumer with concrete sources and registries forbidden. The web client's
  `tests/framework-build.test.ts` additionally compiles the actual shared
  screens with the production Vite configuration and an empty catalog;
  both a concrete implementation and a registry must fail its load guard
  before tree-shaking. This is a shared-client build, not an empty build of
  the whole application. These checks do not replace any production game's
  own required evidence.
- **Attribution and isolation.** Each game's run of a shared
  specification is named and recorded for that game alone: its test is
  `<scenario> [<game>]` and its evidence `scenario:<scenario> [<game id>]`
  (`trace:<n> [<game id>]` for a model), from the runners' own naming
  functions (`tests/game-result-attribution.test.ts`). The conformance
  verdict then holds every game × specification cell to its own evidence:
  `@libs/games-harness-ts` declares, beside each spec run's evidence, which
  games every shared specification needs (`declareRequiredGames`, through
  `@pkgs/conformance-shared-ts/variants`), and
  `libs/tools-harness-ts/conformance/variant-evidence.ts` decides each required cell
  from that game's verdicts alone — passed, failed, stale (its only verdict
  is from another text of the spec), required but missing, or not
  applicable — so one game's pass never stands for another's missing or
  failing run, nor for the spec run once without a game
  (`libs/tools-harness-ts/scripts/conformance-report-variants.test.ts`).
  `tests/game-order-isolation.test.ts` proves the plan, the matrix and the
  laws' verdicts are the same whatever order the games are listed or
  checked in.
- **Depth.** The same suites run in both check profiles; `bun verify-nightly`
  replays more property runs and Quint traces (`verify-profile.ts`).

The matrix today:

| game | rules | custom-games | matchmaking | history | puzzles |
| --- | --- | --- | --- | --- | --- |
| chess | bound | bound | bound | bound | bound |
| Connect Four | bound | bound | bound | bound | — |
| Battleship (private setups) | bound | bound | bound | bound | — |
| counting race (reference, test-only) | bound | bound | — | bound | bound |
| secret pick (private setups, test-only) | bound | bound | bound | bound | — |

Three traits select specifications beyond capabilities for games with
private setups: `a private setup` (the private-setup specifications and
suites), `played on one device` (play on the host's device alone, for every
game without private setups:
`custom-game-offline`, `custom-game-local.qnt`, `custom-game.qnt`,
`custom-game-control.qnt` and the offline solo board suite) and `a seven-move
victory` (the whole-game models `custom-game-control`, `matched-game`,
`matched-game-daily`). Battleship's shortest victory takes 33 shots, so it is
held to the models that follow the start of its known victory; secret pick,
whose victory takes seven moves, carries private setups through the
whole-game models that do not need play on one device.

## Durable names

Names that are stored or sent keep their established identities, even where
they now serve every game: the platform namespace `GAME_PLATFORM_NAMESPACE`
(`'chess'`: table domain, room attributes, outbox and notice messages),
tables `chess_multiplayer_*` and `chess_opponent_searches`, room modules
`chess/custom` and `chess-match`, refusal codes `CHESS_*`, the seat tokens
`white` / `black` (first and second side), the record fields `fen` / `uci` /
`san` / `pgn` (position, action, label, history), chess's unprefixed clock
namespace, and the space-wide game screen (`games/screen`). Puzzles keep
theirs too (listed with [their semantics](#puzzles-the-catalogue-the-session-completion-and-results)):
the `chess_puzzle*` tables, the `chessPuzzle*` queries and the puzzle
mutations (`appendPuzzleInteraction`, `ratePuzzleAttempt`,
`savePuzzleFeedSettings`), the catalogue topic `system:chess_puzzles`,
the session's `chess.puzzle.*` attributes and `chess-puzzle-play-*`
messages, the review's `chess.main-menu.selected-review-*` and
`chess-cmd` / `chess-evt` messages, the route `/chess/puzzle/:puzzleId`,
the screen keys `puzzle`, `stats` and `stats-review`, every chess puzzle
id, profile and feed settings id (the owner id), and the telemetry events
`chess.puzzle.*`. The unprefixed
namespace `''` — of clock choices and of puzzles — belongs to the legacy
definition explicitly selected by the composition root. Its registration
supplies `unprefixedNamespace: true`; `GAME_DEFINITIONS` checks that grant
with `assertGameNamespaceOwner(GAME_DEFINITIONS, chessGameShared)`.
`defineTurnGame` never infers privileges from a game id. `createTurnGames`
refuses an unprefixed namespace without the explicit grant
(`<id>: the unprefixed clock namespace "" belongs to the platform's
durable game alone — use "<id>/"`, and likewise for the puzzle
namespace). Renaming any of
them would change stored histories, pending offline mutations or queued
messages. A game's own positions and actions are stored verbatim: a game that
changes its encoding keeps `recognizes`, `play` and `replay` accepting every
position and action already stored.

## Fit for future games

The shared lifecycles serve **two- to four-seat** games whose state is one
opaque public position, with turns that rotate or that the rules decide
(`turnOrder`), hidden information either set up before play
(`GameRules.setup`) or dealt and kept by the authority (`GameRules.hands`,
with phases of secret choices: `hands.commit`), and results that may name
joint winners. Private setup and puzzle capabilities currently require
two seats; registration refuses unsupported combinations. Each
claim beyond that is an executable probe in
[`libs/games-harness-ts/tests/probes/`](../../games-harness-ts/tests/probes/):
the smallest game that asks the question, written as a game is (its
definitions import only the `gameApi` modules, checked by
[`probe-imports.test.ts`](../../games-harness-ts/tests/probes/probe-imports.test.ts)),
and judged by the framework's own laws and planner
([`probe-verdict.ts`](../../games-harness-ts/tests/probes/probe-verdict.ts)).
A probe need not be enrolled in `CONFORMANCE_GAMES`: what it inherits is
what the shared suites and specifications bind by its capabilities
(`offersAll`), which run for an enrolled game offering the same ones. A
supported probe passes every law; a limitation is pinned by the law that
refuses it, a runtime refusal or a `@ts-expect-error`, so it fails the
day the boundary moves.
The solver-only consumer is enrolled alongside the reference game and
production games; it executes the shared rules and puzzle suites and specs.
The isolated composition also executes setup-race through every applicable
code suite and the shared custom-game and turn features, rather than
relying on its planned enrollment alone.

| Probe | Outcome | Public contracts | Framework change | Shared screens, specs and suites | Boundary |
| --- | --- | --- | --- | --- | --- |
| [Puzzle-first](../../games-harness-ts/tests/probes/puzzle-only.test.ts) (puzzles only: no custom games, opponent or history) | Executable: supported | `defineTurnGame({ capabilities: { puzzles } })`, `defineGameClient({ puzzles })`, `HarnessGame` with known puzzles | None | A space offers exactly Puzzle and Puzzle stats; a known puzzle is solved on the shared puzzle screen; every `specs/games` specification needing only `puzzles`, and the `rules` and `puzzles` code suites | — |
| [Puzzle without an opponent](../../games-harness-ts/tests/probes/puzzle-only.test.ts) (`solo-count`) | Executable: enrolled; broader verification in progress | `PuzzlesCapability.lineMode: 'solver-only'`, the existing definitions and checked harness adapter | Shared layout, navigation, fixture checks and model input binding | Every applicable rules and puzzle suite is automatically enrolled; both attempt and sound models have passing solo replays | A test-only one-person consumer; it advertises no custom games, matchmaking or history. Full verification evidence is tracked in the audit |
| [Turns that do not alternate](../../games-harness-ts/tests/probes/turn-order.test.ts) (`double-turn`) | Executable: supported in custom games when declared | `PlayedPosition.turn`, `GameRules.turnOrder: 'rules'` | Made: the alternation law and the `rotating turns` specifications bind only rotating games; Hearts is the consumer | Every custom-game specification and suite not needing `rotating turns` | Undeclared, the turn law still refuses the game by name. Matchmaking assumes rotation (`bothHaveMoved`, move numbering in pairs), so `defineGame` refuses a matched game deciding its own turns. Simultaneous choices are a phase of secret choices (`hands.commit`), not a position with no side to move |
| [Setup phase](../../games-harness-ts/tests/probes/setup-phase.test.ts) (`setup-race`: each side picks a stride, then races) | Executable: supported as ordinary turns | `GameRules` actions and positions | None | Every custom-game specification and suite; setup actions replay, list and are refused before play like any move | As ordinary actions a setup starts and spends clocks, is numbered as moves and closes a matched game's abort window. A simultaneous, hidden setup is the private-setup phase instead (`GameRules.setup`, below): prepared before the first action, with readiness and a setup deadline of its own, never a move |
| [Result the mover does not win](../../games-harness-ts/tests/probes/results.test.ts) (`misere-tally`) | Executable: supported | `PlayedPosition.winner` | One, made: custom games credited the mover (`custom-game-mover-credited-win`) | Every custom-game specification and suite | A margin or score is only the ending's reason text (`endingDescription(reason)`) |
| [Results beyond one winner](../../games-harness-ts/tests/probes/results.test.ts) (shared win, ranking, score) | Executable: joint winners supported in custom games; scores and rankings a type-level limitation | `GameWinner`, `plainWinner`, `winningSides`, `GameRecordMetadata.outcome` | Made: stored custom outcomes, status, records and history credit every winner; Hearts is the consumer | `specs/games/shared-victories.feature` (trait `a shared victory`) | A matched game records one winner or a draw (Glicko-2 on win/draw/loss); a score is only the ending's reason |
| [More than two participants](../../games-harness-ts/tests/probes/participants.test.ts) | Executable: two to four declared seats (Word Tiles has three) | `GameRules.sides`, `gameSides`, `GameRecordMetadata.participants` | Shared rosters, clocks, group matching, consent, records and synchronization | [Roster conformance](../../games-harness-ts/tests/conformance/custom-games/declared-roster.test.ts), `specs/games/multi-seat-games.feature`, `four-seat-matchmaking.feature`, `multi-seat-recovery.feature` | Private setups and puzzles remain two-seat capabilities; a seat whose person is away is played by a disclosed stand-in in custom games (`multi-seat-stand-ins.feature`) |
| [Participant-private state](../../games-harness-ts/tests/probes/private-state.test.ts) | Executable: supported as private setups and dealt hands; per-viewer positions a limitation | `GameRules.setup`, `GamePresentation.SetupBoard`, `GameAutomation.arrange`, `fixtures.setups`; `GameRules.hands`, `GameBoardProps.hand`, `fixtures.knownDeal` | Made: private room events, authority-only resolution, owner-only setups and hands in matched games, hidden state no device holds, the viewer's own setup or hand on every board | Every shared specification and suite for what it offers, plus the private-setup and dealt-hands ones; secret pick, Battleship and Word Tiles | A position that differs per viewer (a fog that lifts) is still one public string: `GameBoardProps` takes no viewer and the rules decide with no actor |
| [A surface unlike a chessboard](../../games-harness-ts/tests/probes/play-surface.test.ts) | Executable: supported | `GamePresentation.Board`, `GamePuzzlesClient.Board`, `PuzzleMarks` | None | The reference game's board is a row of buttons and its cells counts; it runs every shared specification and suite it offers | Puzzles mark cells (`PuzzleMarks.to`, `isCell`), the board faces a side (`orientation`), and automation is one pointer gesture (see Known limits) |

### Change impact

What changes, verified against this branch's history:

| Change | What changes | Framework | Evidence |
| --- | --- | --- | --- |
| A game with existing capabilities | The game's packages (`<id>-shared-ts`: rules, `defineTurnGame`; `-client-ts`: board, `defineGameClient`; `-harness-ts`: `PlayableGame`, `HarnessGame`, fixtures; `specs/<id>/`); one entry each in `GAME_DEFINITIONS`, `GAME_CLIENT_DEFINITIONS`, `HARNESS_GAMES`; workspace setup ([`ADDING_A_GAME.md`](ADDING_A_GAME.md) §4: `tsconfig.paths.json`, root `tsconfig.json`, registry manifests, `turbo.json`, `lingui-scope.ts`, `specs/conformance.yaml`) | None | Connect Four's registrations (no framework file names it); `dc15000ea` (the reference game takes up puzzles: its file, its faulty copies and the suites, no framework source); the puzzle-only, misère, setup and surface probes |
| Optional configuration of a capability | The field in its public contract module (`game-puzzles.ts`, `game-rules.ts`, `harness-game.ts`), the framework code reading it, the law holding it, `GAME_TRAITS` if specifications need it, the docs; only games opting in | Contract + reader | `efa1cf428` (`secondSideCannotWin`), `cc9ea727f` (`drawByRules`): `harness-game.ts`, `game-rules-laws.ts`, `game-conformance.ts`, the steps, and only the playables opting in. Optional capability fields (`judge`, `content.positionKey`) came with the capability (`e74e57b9b`); by inspection one more touches `game-puzzles.ts` and `game-puzzle-shared` alone |
| A specialised action or rendering component | The game's own packages: its board, its puzzles client part (`Companion`, `coach`, `notation`, `useFeedback`), its own `screens` / `choices` or `GameOwnRoom` | None | `973dd1afd` (one file, `chess-puzzle-board.tsx`) |
| A capability for a new class of game | `pkgs/turn-game-shared-ts` (the contract module, `GAME_CAPABILITIES`, `CAPABILITY_REQUIRES`, `gameApi`), `defineTurnGame` (installing its shared module), `defineGameClient` and `assertMatchingGameIds` (its client part), `GameFixtures` and `assertHarnessGame` (its known examples), its laws, `tests/conformance/<capability>/`, `SHARED_SPECIFICATIONS` and `specs/games/`, its sub and composition (`app-subs`, `gameSystem`), the docs | Contracts + internals | Puzzles: `e74e57b9b` (contract, no game file), `907e5d0f8` (`PUZZLE_SESSIONS`, `harness-game.ts`), `f4b73b343` (client part, `game-client.tsx`, `load-game-plugins.ts`, `app-sub-clients.ts`), `44df2e627` (fixtures, laws, suites), `3c6b2c60c` and the binding commits after it |
| Evolving persisted state | Never a [durable name](#durable-names); a new partition in reads, not tables; a recorded session replayed to the same events; a game's own encoding kept readable by its `recognizes` / `play` / `replay` | Internals | `a72377df5` (puzzle namespaces through `puzzle-namespace.ts`, the catalogue and reads; `puzzle-tables.ts` untouched), `907e5d0f8` (`chess-puzzle-harness/tests/puzzle-session-compatibility`), `49a13b2e8` (`GAME_PLATFORM_NAMESPACE`) |
| An internal framework change | Framework internals and their tests only | Internals | `aa2c6dcb6` (`settle-due-game.ts`), `287ba476f` (the matchmaking harness): no game file; likewise this probe work's `custom-game-play.ts` fix and turn law |

## Solver-only puzzle integration

`PuzzlesCapability.lineMode` defaults to `opponent-replies`; `solver-only`
means that every line entry is a solver action, with no automatic setup or
reply. The core room now starts that mode at its supplied position (index
zero), waits for each solver move, and permits review back to that position.
Its judge and solution staging use the same declared layout. Existing
production games retain the default, and their durable messages and names
are unchanged.

Client navigation and review now use the declared starting index. Review
distinguishes an unset cursor from an explicit zero, and both common model
instances have executable proof. This is not yet a complete integration
path until all inherited checks pass. The solo consumer now has three checked
known puzzles, thirty further distinct puzzles, a real board and audio
feedback, and automatic shared-suite enrollment. The attempt and sound
models replay both layouts, with independent action covers and evidence.
The general rules laws require alternation and a chance to win for both sides
only for consumers offering head-to-head play. Opponent puzzle fixtures
still require an opponent input; solver-only fixtures must omit it. Follow
[`FINAL_HARDENING_AUDIT.md`](FINAL_HARDENING_AUDIT.md) for current evidence;
no production game advertises the new mode.

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
- Playing a puzzle — the feed, the attempt, hints, retries, the shown
  solution, the clock, resuming and the review — and the feed's settings
  and gates, how the next puzzle is chosen, the puzzle rating, the stats
  and the game log, the daily puzzle limit (one allowance for every game
  offering puzzles), playing as a guest and carrying that progress over,
  what a puzzle refuses, erasing a deleted account's puzzle progress,
  playing offline and for days without a connection, a result counted
  once across closing the app and two devices, friends watching and
  arriving mid-puzzle, puzzle links, the app's sounds, the results heard
  and the controls from the keyboard, a win off the line, and other play
  leaving the puzzles alone are every game's in specification
  (`specs/games/puzzle-*`, `solve-*`, `deleted-account-progress`,
  `puzzle-attempt.qnt`, `puzzle-feed.qnt`, `puzzle-link.qnt`,
  `puzzle-result-recovery.qnt`, `puzzle-sound.qnt`,
  `daily-puzzle-limit.dmn`, `puzzle-progress.als`,
  `puzzle-ready.openslo.yaml`) and run for chess and the reference game (a
  race where a turn may count two or three, so a move can be legal and
  wrong) on their known puzzles, in a world whose catalogue holds exactly
  those (`gameSystem(…, { knownPuzzles: true })`); a scenario's pool (its
  ratings, quality, themes) is those same known puzzles rewritten through
  the catalogue writer (`puzzle-pool`). Every number of the feed and the
  rating — the 1500 start, the floor 400 and ceiling 3000, the offset of
  ±400 in steps of 50, the custom target 400 to 3000, the windows of 100
  and 200, the quality bar and half credit — is the platform's
  (`@libs/game-puzzle-shared-ts` `rating`, `feed-config`,
  `next-puzzle-selection`); no game supplies one, nor the daily limit's 20
  (`@libs/permissions-shared-ts`), whose earlier starts a scenario writes to
  the one ledger (`puzzle-allowance`). Days of offline play stock the
  game's more puzzles (`morePuzzles`, at least thirty) before going
  offline. A game's sounds are heard as it names them
  (`HarnessGame.puzzleSounds`); the results someone listening hears are
  the platform's live region (`Handles.puzzleResultAnnouncement`), a
  game's words about its moves its own companion's. The rest of the
  puzzle specifications — saved puzzles, the Puzzle Assistant (and why it
  says nothing happens from an earlier position), chess's capture sound,
  spoken moves and squares, a legal checkmate counting as one, and chess's
  own themes such as "fork" (`specs/chess/puzzle-*`, `puzzle-assistant.qnt`,
  `puzzle-sound.qnt`, …) — still name chess and its board, so only chess
  is held to them. A game's puzzle stats outside any space are on
  the game's own route (chess's `/more/chess-stats`, pinned by
  `specs/product.machine.json`; the reference game's
  `/more/counting-race-stats`) behind a Settings row marked
  `Handles.settingsPuzzleStats(<game id>)`; they can become the platform's.
- The custom-game, matched-game and puzzle-attempt models are every
  game's. Chess keeps only its own puzzle and Lichess models; a model that
  moves takes its model-check task and its share of chess's spec parts to
  `@libs/games-harness-ts`, which the PR runner's capacity (`ci-load.ts`)
  needs. Both suites plan their models' replays
  (`tests/quint/replays.json`, written by
  `libs/harness-ts/scripts/model-replays.ts --write`): what each model's
  tests replay on the pinned seed, once per game it holds for, so a part
  is sized by the replays it runs in the pull-request gate and nightly,
  not by a fixed count of drawn traces; a model's run fails when its draw
  no longer matches the plan. Each suite runs in the fewest parts whose
  replays (sixteen to a part, four to a file, four times as many nightly)
  and scenario load (`PART_LOAD` in `libs/harness-ts/scripts/spec-parts.ts`)
  stay inside their caps: chess 7, games 41. Each model is still checked
  in a task of its own (seven and sixteen model-check tasks, the
  matched-game model's sixteen phases apart).
- A game with dealt hands offers no rated puzzle feed; Word Tiles' one-move
  challenges are authored puzzle content instead. A solo practice game's deal
  is on its creator's device, which could read the bots' racks: practice,
  not a contest. The models that name every bot move along the
  victory line (`custom-game-control`, `custom-game-local`) need a bot that
  chooses among the position's legal moves by its draw (`a bot choosing among
  legal moves`); a bot proposing from a hidden hand does not, so they hold
  for every other game, while the offline features, the whole custom-game
  model and the four-seat recovery hold for dealt hands too.
- A matched game's result is a single winner or a draw; joint winners are a
  custom-game result (Hearts' tie for the lowest score).
- Secret choices and turns the rules decide are custom-game capabilities;
  `defineGame` refuses either in a game offering matchmaking.
- A game with private setups is never played on the host's device alone,
  so the offline solo specifications and the custom-game model (whose host
  chooses alone with no connection) hold only for games without them
  (`played on one device`); its custom game against a bot needs the
  connection and a move made without one waits for it.
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
  reads (`libs/harness-ts/src/parameter-types.ts`).
