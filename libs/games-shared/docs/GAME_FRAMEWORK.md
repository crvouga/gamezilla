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
   and returns the only value the registry accepts (a branded
   `TurnGameDefinition`). `defineGameClient` does the same for the client.
2. **Registration.** One entry in `GAME_DEFINITIONS`, one in
   `GAME_CLIENT_DEFINITIONS` (client bundles only), one in `HARNESS_GAMES`
   (tests only). The three are checked to agree, entry for entry.
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
| `matchmaking` | Finding an opponent at a clock choice, matched games, ratings per speed, turn and result notices, rematches, the multiplayer link | `clockNamespace` (`'<id>/'`), `notice` copy for server-sent notices |
| `history` | History, statistics and review of finished games; the downloadable record | `record(position, history, metadata)` |

A game never supplies a placeholder for a capability it does not offer, and
the platform shows, accepts and tests nothing for an absent one.

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
  `@libs/games-harness/game-conformance`). Each game's run is its own test,
  `<scenario> [<game>]`, recording its own evidence obligation
  (`scenario:<scenario> [<game id>]`), so the job log and Atlas name the game.
- **Shared code suites.** A test under `tests/conformance/<area>/` of
  `@libs/games-harness` runs once per game its area binds (`rules`: every
  game; otherwise the capability of that name), as `<game> › <area> › <suite>`.
  The rules laws are property tests (`assertProperty`): positions name one
  game, replay reproduces every position, the moves shown are the moves
  played, only legal actions are accepted, and automation and bots choose
  legally.
- **Independent oracles.** Expected outcomes come from each game's
  `fixtures` — a known first-side victory and known refused openings,
  written from the game's own laws — or from the contract, never from asking
  the implementation whether it agrees with itself. Faulty copies of the
  reference game prove each law refuses the fault it names.
- **The matrix.** `tests/game-conformance-matrix.test.ts` derives the
  game × area matrix from offered capabilities and the suites on disk,
  prints it, and fails on an offered capability no suite verifies. An
  unoffered capability is `—` (unsupported), never "not tested".
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
namespace, and the space-wide game screen (`games/screen`). Renaming any of
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
- About thirty-one `specs/chess/` features still describe shared behaviour
  for chess alone: custom-game access, connection, devices, history,
  privacy and recovery; matched-game clocks, notices, reminders, ratings,
  time controls and recovery. Each moves the way the matched-game lifecycle did:
  a `spec:` commit rewording it for every game in `specs/games/`, then one
  binding in `@libs/games-harness` over the shared matched-game and
  custom-game worlds, deleting chess's copy.
- The shared specifications have no game-neutral Quint model yet; chess's
  `custom-game-play.qnt` and `multiplayer.qnt` draw chess lines. A shared
  model needs the Quint runner to replay traces per game (as Gherkin
  variants do) and a model-check task, which the PR runner's capacity
  (`ci-load.ts`) only allows by retiring chess's copy.
- A game's own Gherkin parameter types join the one list the spec check
  reads (`libs/harness/src/parameter-types.ts`).
