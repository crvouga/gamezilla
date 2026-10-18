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
| `@pkgs/turn-game-shared` | The contracts: `GameRules`, `TurnGameCapabilities` and their parts (`GameBots`, `MatchmakingCapability`, `HistoryCapability`), `TurnGames` (lookup by id, position and clock), `GamePresentation`, `GameAutomation`. |
| `@pkgs/turn-game-client` | `TurnGamesProvider` and `useGamePresentation`: the shared screens find a position's presentation. |
| `@libs/spaces-shared` | `GameDefinition` and `GameClientDefinition` (what a space can play), `GameOwnRoom` (a game's own room behaviour), `SharedGameModule`, and the space room that composes them. |
| `@libs/game-session-shared` | `defineTurnGame`, custom games (sides, people, bots, readiness, clocks, resignation, draws, rematches, offline solo play) and the shared session module installed once per space. |
| `@libs/game-session-client` / `-server` | The custom-game, history and review screens; the matched-game notice, reminder and availability consumers. |
| `@libs/game-matchmaking-shared` / `-client` | Opponent searches, matched games, ratings per speed, rematches, the multiplayer screen and link. |
| `@libs/game-menu-client` | `defineGameClient` and the one `GameMenu` every game is offered through. |
| `@libs/game-session-harness` | The conformance contract a game's harness supplies (`PlayableGame` without screens, `HarnessGame` with them, `GameFixtures`), `gameSystem` (a world of any games), shared drivers, and the rules laws (`game-rules-laws`). |
| `@libs/game-matchmaking-harness` | Opponent seeking and the one matched-game scenario world. |
| `@libs/games-harness` | `HARNESS_GAMES`, the conformance matrix, every shared suite and the steps of `specs/games/`. |

A game owns its rules (opaque positions and actions), its board component,
its presentation and notice copy, its UI automation gesture, its own
screens and room behaviour if it has any, and its own rules specifications
in `specs/<game>/`.

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

| game | rules | custom-games | matchmaking | history |
| --- | --- | --- | --- | --- |
| chess | bound | bound | bound | bound |
| Connect Four | bound | bound | bound | bound |
| counting race (reference, test-only) | bound | bound | — | bound |

## Durable names

Names that are stored or sent keep their established identities, even where
they now serve every game: the platform namespace `GAME_PLATFORM_NAMESPACE`
(`'chess'`: table domain, room attributes, outbox and notice messages),
tables `chess_multiplayer_*` and `chess_opponent_searches`, room modules
`chess/custom` and `chess-match`, refusal codes `CHESS_*`, the seat tokens
`white` / `black` (first and second side), the record fields `fen` / `uci` /
`san` / `pgn` (position, action, label, history), chess's unprefixed clock
namespace, and the space-wide game screen (`games/screen`). The unprefixed
clock namespace `''` belongs to the game whose id is
`GAME_PLATFORM_NAMESPACE` alone: `defineTurnGame` grants it to that game
(`unprefixedClockNamespace`), and `createTurnGames` refuses it for any
other (`<id>: the unprefixed clock namespace "" belongs to the platform's
durable game alone — use "<id>/"`). Renaming any of
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
