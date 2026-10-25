# Adding a game

A game supplies only what makes it unique: its rules, its board, its copy,
the gesture that plays an action on its board, and the known examples its
tests are held to. The framework owns everything around them and holds the
game to every shared specification and suite for what it offers. How the
framework is built: [`GAME_FRAMEWORK.md`](GAME_FRAMEWORK.md).

For standalone puzzles or author-created content alongside a turn game, use
[`ADDING_A_PUZZLE_GAME.md`](ADDING_A_PUZZLE_GAME.md). The turn-game examples and
rated puzzle feed below do not require a puzzle-content game to invent turns
or an opponent.

The complete, working example of everything below is the test-only
reference game,
[`counting-race-game.tsx`](../../games-harness-ts/tests/reference-game/counting-race-game.tsx).

## 1. The game's packages

For a game with id `race` (a lowercase slug; it is the game's wire id):

| Package (`"game": "race"`) | File | Holds |
| --- | --- | --- |
| `libs/race-shared-ts` (isomorphic) | `race-rules.ts` | `GameRules`: `id`, `recognizes`, `initial`, `play`, `replay`, `legal`, `canWin`, `moves`. Positions and actions are opaque strings; `recognizes` accepts only this game's positions. |
| | `race-game.ts` | `raceGameShared = defineTurnGame({ … })` — the registration. |
| `libs/race-client-ts` (client) | `race-board.tsx` | The board: renders a position, calls `onAction`, prefixes its controls with the `testId` it is given. |
| | `race-game-client.tsx` | `raceGameClient = defineGameClient({ shared: raceGameShared, … })`. |
| `libs/race-harness-ts` (harness) | `race-playable.ts`, `race-harness-game.ts` | `RACE_PLAYABLE: PlayableGame` (label, shared definition, fixtures) and `RACE_HARNESS_GAME: HarnessGame` (adds the client) — the conformance adapter. |
| | `tests/` | The game's own rules specs and regressions. |
| `specs/race/` | features, glossary | The game's own rules in its own words (a `spec:` commit). |

Every package declares `"game": "race"` in its `package.json`; it may
depend on the framework and its own packages, never on another game or a
registry. This also applies to reusable game-specific engines or boards
under `pkgs/`: generic framework code cannot depend on a concrete game's
engine through an unclassified helper package.

### What a game may import

A game imports only the framework's public modules, each framework
package's `"gameApi"` list. The package's `lint` refuses anything else,
in source, tests and steps alike (the full map and the reasons are in
[The public API](GAME_FRAMEWORK.md#the-public-api)):

| From | A game imports |
| --- | --- |
| `@pkgs/turn-game-shared-ts` | `game-rules`, `game-presentation`, `game-automation`, `game-puzzles`, `puzzle-content`, `puzzle-content-catalog` |
| `@libs/game-session-shared-ts` | `game-definition`, `turn-game-definition` |
| `@libs/game-menu-client-ts` | `game-client` |
| `@libs/game-puzzle-shared-ts` (a game offering puzzles) | `puzzle-catalogue`, `sub`, `puzzle-link`, `completion`, `hint-stage`, `solve-status` |
| `@libs/game-puzzle-client-ts` (a game offering puzzles) | `puzzle-client`, `puzzle-content-client` |
| `@libs/spaces-shared-ts` | `game` (only for a game with its own room behaviour) |
| `@libs/game-session-harness-ts` (its `-harness`) | `harness-game`, `known-puzzles`, `game-system`, `game-navigation`, `space-game-choice`, `custom-game-ui`, `custom-game-controls`, `custom-game-lineup`, `custom-game-moves`, `custom-game-screen`, `custom-game-reads`, `custom-game-history`, `puzzle-session-probe`, `puzzle-fixtures`, `puzzle-screen`, `puzzle-records`, `puzzle-moves`, `puzzle-room-probe`, `puzzle-link`, `puzzle-finishes`, `puzzle-result-recovery`, `puzzle-listening`, `puzzle-sounds` |
| `@libs/game-matchmaking-harness-ts` (its `-harness`) | `matched-game-world`, `matched-game-app.steps`, `opponent-seeking`, `multiplayer-board`, `multiplayer-review`, `multiplayer-game-record`, `multiplayer-time`, `matched-game-fixtures` |

Nothing else: not the platform's screens, consumers or storage, and never
a stored type, a probe, a table or a transport client. A game reads its
Custom Game through `custom-game-screen` and its matched game through
`matched-game-world`. Its board gesture goes through
`playOnCustomGameBoard` or `sendMoveFromBoard`, and a scenario's given
position through `matched-game-fixtures`. If the game needs something the
list does not offer, add a focused read, action or fixture helper to a
public module, or move the test to the framework when it checks the
framework's behaviour. Never make an internal module public. A game's own
tests call only its own contract: its rules, its `history.record`, its
bots.

## 2. Register the game

When several mode ids share one implementation, declare `GameRules.family`
as the `"game"` value their packages carry. It defaults to the mode's id for
a single-mode game. Every mode still needs its own entry in each registry
and its own conformance adapter.

Declare a mode's ordered seats on its `GameRules.sides`. Omitting it selects
`['white', 'black']`; a four-seat mode declares all four stable tokens in its
turn order. The declaration determines lobby readiness, bot seats and
matchmaking group size. Modes register separately in the three registries and
share their game's rule and board primitives. A record reader for more than
two seats supplies its complete `participants` list, in declared order, for
the shared record laws. Validate narrower board identities with
`requireTwoPlayerSide` when adapting a two-player board.

```ts
// libs/race-shared-ts/src/race-game.ts
import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';

export const raceGameShared = defineTurnGame({
  rules: raceRules,
  capabilities: {
    // Each capability is offered by supplying what it needs; leave one out
    // and the platform neither shows nor accepts it.
    'custom-games': { bots: { difficulties: ['easy'], choose: chooseStep } },
    history: { record: (position, history, metadata) => raceRecord(position, metadata) },
    // Finding an opponent needs history beside it: every finished matched
    // game offers its game record.
    // matchmaking: { clockNamespace: 'race/', notice: raceNoticeText },
    // Puzzles need nothing else: the catalogue's namespace, whether a stored
    // record is one of the game's puzzles, the cells an action names and
    // the board's cells (optionally its canonical spelling of an action and
    // when two positions are the same).
    // puzzles: { namespace: 'race/', content: { validate: validateRacePuzzle },
    //   marks: (position, action) => ({ from: null, to: action }), isCell },
  },
  automation: {
    choose: (position, random) => chooseStep(position, 'easy', random),
    perform: (ui, board, action) => ui.get(`${board}-${action}`).tap(),
  },
});
```

```tsx
// libs/race-client-ts/src/race-game-client.tsx
export const raceGameClient = defineGameClient({
  // The shared registration: its id, and which parts are asked for.
  shared: raceGameShared,
  title: 'Race',
  caption: 'Count to five first',
  subtitle: () => <Trans>Take turns counting on.</Trans>,
  presentation: { name: () => t`Race`, canFlip: false, Board: RaceBoard, sideLabel, endingDescription, endingLabel, timeoutDrawDescription },
  // Exactly when raceGameShared offers puzzles (a type error otherwise):
  // puzzles: racePuzzlesClient,
});
```

### Offering a rated puzzle feed

Puzzles are offered by a part on each side, and nothing else changes:

- **Shared** — `capabilities.puzzles` (above): the namespace `'race/'`,
  `content.validate`, `marks`, `isCell`, optionally `judge` and
  `content.positionKey`.
- **Client** — `puzzles` in `defineGameClient`, a `GamePuzzlesClient`
  (`@libs/game-puzzle-client-ts/puzzle-client`): `Board(props)` draws the
  position it is given at `props.size`, reports a move through
  `props.onAction`, marks `props.marks` (a wrong move's cell, a hint's
  cell, the shown solution) and draws `props.suggestions` (watchers'
  moves, each in its colour); in `mode: 'review'` it is read-only and
  slides only when `props.animated`. Optionally: `coach(attempt)` (the
  line the coach says), a `Companion` (the game's own live region or
  probes beside the board), `themes` (feed filters and their names),
  `notation` (the move list's notations, the first the default; how a
  move is written and numbered) and `useFeedback` (its sounds; the
  platform plays the haptics). The prompt names the solver's side as the
  game's `presentation.sideLabel` does, and the platform shows the
  attempt's test probes itself.
- **Catalogue** — the game's import writes its puzzles through
  `admitCataloguePuzzle` and `insertNewCatalogueRows` /
  `upsertCatalogueRows` (`@libs/game-puzzle-shared-ts/puzzle-catalogue`),
  with ids `race/<local id>`; a puzzle the game does not recognise or
  validate is refused.
- **Fixtures** — `fixtures.puzzles`: the game's known puzzles (below),
  written from its own laws. Each names its stored record, the side the
  solver plays, the solution (the line's solver moves), how the rules
  label every line move, a wrong move (legal, neither the line's nor a
  win), a refused move and a move for the opponent's side (both refused
  by its rules, each tried on its board with its automation's gesture),
  each at a solver move of the line (`at`); and, where the game's puzzles
  have one, a win off the line (`wonAnotherWay`) or a transposition. At
  least one has two solver moves. The shared puzzle specifications run on
  them: "the game's known puzzle" is the first whose line is four moves
  long, the puzzle pool of their world holds exactly the known puzzles
  (`gameSystem(…, { knownPuzzles: true })`), and the puzzle attempt model
  needs three of two solver moves each, with a legal move at each that is
  neither the line's nor a win nor another way the author names. A pool a
  scenario describes is made of those three, rated, themed and judged for
  quality as it says. Rate every known puzzle below a new solver's 1500
  (a wrong move's half credit then lowers the rating) and two of them
  within 100 of it (a settled 1500 then has a next puzzle in its rating
  window after a solve); give the known puzzle a theme the client's feed
  `themes` offers, and offer one theme no known puzzle has. Name at least
  thirty more puzzles (`fixtures.morePuzzles`, each held to what a known
  puzzle is, none repeating another's position and line), which days of
  offline play stock. And name the sounds its puzzles play
  (`puzzleSounds` on the `HarnessGame`: each source its `useFeedback` or
  board plays, as a move, a correct move, a wrong move, the end of the
  line, a solve or a rating), with at least a move, a correct move, a
  wrong move and an end sound. That is all a game supplies: every puzzle suite and specification, its
  orchestration and assertions and the faulty copies that prove them are
  the framework's.

A puzzle game's personal stats are registered by the client composition,
through `createPersonalPuzzleStatsClients`. Games supply no route or settings
wrapper. The shared `/more/<game id>-stats` screen shows the person's own
rating, log and reviews, regardless of the space host's connection.

The platform then offers Puzzle and Puzzle stats among the game's
choices, the feed and its settings, ratings and feed settings of the
game's own, review, watchers' suggestions, the puzzle link, the results
said for someone listening, the controls from the keyboard and the
conformance puzzle suite; the game's puzzles share the one daily puzzle
limit a guest has across every game offering puzzles, and play as a
guest, refuse a choice, erase a deleted account's progress, play offline
and for days without a connection, count a result once across closing
the app and two devices, are watched, linked, heard and kept apart from
other play as every game's do (`specs/games/puzzle-*`, and the
`puzzle-attempt`, `puzzle-feed`, `puzzle-link`, `puzzle-result-recovery`
and `puzzle-sound` models). A known puzzle won another way
(`wonAnotherWay`) holds the game to `puzzle-objective` too; without one,
the puzzle laws check its rules win each known puzzle only by its line.

Then add one entry to each registry — the only edits outside the game's
packages besides workspace setup (step 4):

1. `libs/games-shared-ts/src/game-plugins.ts`: `raceGameShared` in `GAME_DEFINITIONS`.
2. `libs/games-client-ts/src/game-plugins.client.ts`: `raceGameClient` in `GAME_CLIENT_DEFINITIONS`.
3. `libs/games-harness-ts/src/harness-games.ts`: `RACE_HARNESS_GAME` in `HARNESS_GAMES`.

### A game with private setups

When the sides prepare something in secret before play (a hidden fleet),
supply it in the rules and nowhere else — the platform does the rest
([semantics](GAME_FRAMEWORK.md#private-setups-gamerulessetup)):

- **Rules** — `setup: { accept, random, resolve }` beside the other rules.
  Positions stay public: `legal` lists proposals (`e5`), `resolve(position,
  proposal, setups)` gives the public action the authority records
  (`e5:hit`), and `play`, `replay` and `moves` take public actions. Bots and
  automation choose from the public position; they never receive a setup.
- **Client** — `presentation.SetupBoard` (`GameSetupBoardProps`: the
  arrangement so far, which may be `''` or incomplete, `locked`, `onChange`,
  `side`, `testId`); every `Board` receives the viewer's own `setup`, or
  `null`.
- **Automation** — `arrange(ui, board, setup)`, the gesture that enters a
  setup on the setup board.
- **Fixtures** — `setups: { white, black }`, one complete setup per side as
  the game stores it; every known line is the proposals people make,
  resolved against them (Battleship: `libs/battleship-harness-ts`).

The platform then gives the game private readiness in custom games, a setup
phase with its own deadline in matched games, the private-setup
specifications and privacy suites, and the test-only consumer secret pick
as its game-independent twin. Such a game offers no puzzles.

### A game with dealt hands

When the authority deals hidden information as the game starts and keeps it
as play goes on (a bag of tiles, each side's rack), supply it in the rules
and nowhere else
([semantics](GAME_FRAMEWORK.md#dealt-hands-gameruleshands)):

- **Rules** — `hands: { deal, hand, resolve, proposals }`. Positions stay
  public: `resolve(position, proposal, hidden)` gives the public action and
  the next hidden state, or a refusal; `play`, `replay` and `moves` take
  public actions. Keep enough entropy in the hidden state that a side cannot
  search for it from what it sees.
- **Data** — immutable data the rules decide with (a word list) loads in
  `prepare`, which the platform awaits; keep it in its own chunk so other
  games never download it.
- **Bots and automation** — `choose` receives the bot side's own hand.
- **Client** — every `Board` receives the viewer's own `hand`, or `null`.
- **Fixtures** — `knownDeal: { draws, hidden }`, the authority's draws and
  the hidden state they deal; every known line is the proposals people make
  from that deal (Word Tiles: `libs/word-tiles-harness-ts`).

The platform then gives the game private hands in custom games and finding
an opponent, the dealt-hands laws and privacy suites. Such a game is never
played on one device alone and offers no rated puzzle feed; it may offer
authored puzzle content and [starter content](ADDING_A_PUZZLE_GAME.md#ship-starter-content).

## 3. Supply the conformance adapter

```ts
// libs/race-harness-ts/src/race-playable.ts — what any driver needs to play
// the game (journeys, synthetic users); it loads no client code.
export const RACE_PLAYABLE: PlayableGame = {
  label: 'race',
  shared: raceGameShared,
  fixtures: {
    // Written from the game's laws, never computed by its implementation.
    // Seven moves: the victory every custom-game and matched-game model follows.
    firstSideVictory: ['step', 'step', 'step', 'step', 'step', 'step', 'step'],
    // How the game writes each of those moves in its move list and its
    // game record, as its rules label them.
    firstSideVictoryLabels: ['1', '2', '3', '4', '5', '6', '7'],
    refusedOpenings: ['back', ''],
    // Only for a game with positions where a side cannot win (chess's bare
    // king): a line to one, ending with the first side's move. Without it
    // the head-to-head rules laws check that both sides can always win.
    // secondSideCannotWin: [...],
    // Only for a game its rules can draw (chess's repetition, Connect
    // Four's full board): a line the rules draw on its last move. Without
    // it the rules laws check that the game is never drawn by its rules.
    // drawByRules: [...],
    // Exactly for a game offering puzzles (a type error otherwise, typed
    // PlayableGame<typeof raceGameShared.capabilities>): its known puzzles.
    // puzzles: [{
    //   record: { id: 'race/leap-home', position: 'race:4b', line: ['advance', 'leap'], rating, … },
    //   solverSide: 'white',
    //   solution: ['leap'],
    //   labels: ['step 5', 'leap to 7'],
    //   wrongMove: { at: 1, action: 'advance' },
    //   refusedMove: { at: 1, action: 'retreat' },
    //   opponentMove: { at: 1, action: 'tortoise-advance' },
    // }, …],
  },
};

// libs/race-harness-ts/src/race-harness-game.ts — the shared suites' adapter.
export const RACE_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...RACE_PLAYABLE,
  client: raceGameClient,
  // Only for a game offering finding an opponent and history: its game
  // record read back in its own format (names, result, clock choice, moves),
  // written without the game's code.
  // readRecord: readRaceRecord,
});
```

For puzzles without an opponent, declare `puzzles.lineMode: 'solver-only'`.
Every recorded action belongs to the solver, starting at index zero in the
supplied position. Include every action in the fixture's `solution` and omit
`opponentMove`; the default opponent layout still requires that refused
opponent input. The test-only `solo-count` consumer demonstrates checked
fixtures, board gestures, marks and audio through the same shared suites.

That is all. The game is now enrolled automatically:

- `specs/games/*.feature` runs for it wherever it offers what a feature
  shows (and, for a feature needing a trait such as a side that cannot
  win, wherever its fixtures show it), each scenario its own test named
  `<scenario> [race]`, and so do the
  `specs/games/` models (each trace `<trace> [race]`), decision tables,
  structures and objectives;
- `libs/games-harness-ts/tests/conformance/rules/` holds its rules to the laws
  every game keeps, and `…/<capability>/` to each capability it offers;
- the conformance matrix gains a `race` row and fails if the game offers a
  capability no suite verifies.

No shared suite, specification or screen changes. If one would have to,
that is a framework defect: fix the framework, not the suite.

## 4. Workspace setup every new package needs

New packages are wired like any other package; each omission fails a check:

| Setup | Check that fails without it |
| --- | --- |
| `tsconfig.base.json` paths and the root `tsconfig.json` include | `tc` |
| A client package using Lingui macros in `LINGUI_CATALOG_SOURCES` (`libs/tools-harness-ts/scripts/lingui-scope.ts`) and the `@libs/tools-harness-ts#ci:i18n` inputs | the package's `lint`, `ci-i18n.test.ts` |
| Solid lint scope (`libs/tools-harness-ts/port/solid-scope.json`) | the package's `lint` |
| `specs/race/` listed in `specs/conformance.yaml` contexts and the context map (`specs/README.md`) | `@libs/tools-harness-ts#ci:conformance`, `bun spec:verify` |
| A harness running `specs/race/` declares `specDomains`, `specParts` and its parts in `apps/product-ts/scripts/ui-quality/sources.json` | `ui-quality-graph.test.ts`, `ci-load.test.ts` |

A game's own Gherkin parameter types join `libs/harness-ts/src/parameter-types.ts`.

## 5. What fails early

| Mistake | Fails at |
| --- | --- |
| A capability without what it needs, an unknown capability, a placeholder (`history: undefined`) for one not offered, finding an opponent without history | type checking (`TurnGameCapabilities`), and `defineTurnGame` when the module loads |
| Missing or non-function bot, notice, history or puzzle implementations; missing, malformed or unknown bot difficulties | `defineTurnGame`, naming the required capability member before installing its sessions |
| A duplicate bot difficulty, an id that is not a slug | `defineTurnGame`, when the module loads |
| A clock or puzzle namespace other than `'<id>/'`, a starting position another game recognizes, a duplicate id | `defineTurnGame` and `createTurnGames`, at registration; composition alone grants the legacy definition `unprefixedNamespace: true` and refuses another definition claiming it |
| Puzzles without `content.validate`, `marks`, `isCell` or a namespace | type checking (`PuzzlesCapability`), and `defineTurnGame` when the module loads |
| A game offering puzzles whose client has no `puzzles` part (with its `Board`), or a `puzzles` part for a game offering none | type checking (`GameClient`), `defineGameClient` when the module loads, `assertMatchingGameIds` and `assertHarnessGame`, each naming the fix |
| A catalogue puzzle outside the game's namespace, in a position the game does not recognise, or refused by its `content.validate` | `admitCataloguePuzzle`, which no row skips |
| A hand-built or copied definition or client | type checking (only `defineTurnGame` makes a `TurnGameDefinition`, only `defineGameClient` a `GameClientRegistration`), and the registries when they load |
| A screen key that is not a slug, is declared twice or belongs to the platform (`puzzle`, `stats`, `stats-review`, `custom-game`, `multiplayer`, `history`, `settings`, `choices`) | `defineGameClient` |
| A client missing, extra or out of order | `assertMatchingGameIds`, naming the entry to fix |
| A game missing from `HARNESS_GAMES` (or there but not registered) | the conformance plan (`game-conformance-matrix.test.ts`) |
| A harness game omitted from execution; duplicate execution identities; a suite missing any eligible game's case or claiming another game's case | the conformance plan; another suite's pass cannot fill the missing case |
| Fixtures the game's rules contradict (a known puzzle's line, labels, solver, wrong, refused or opponent's move included), ids that differ between the definitions, a game offering puzzles without known puzzles (or naming them without offering them), none of two solver moves, a known puzzle outside its namespace | type checking (`GameFixtures`), and `assertHarnessGame` |
| A puzzle its validation refuses or another game's it accepts, a line its judge does not follow to the solve, a wrong move judged otherwise, a legal move judged illegal, marks that name no cell, a board its automation cannot play the solution on | `tests/conformance/puzzles` |
| Rules that break a shared law (replay, isolation, legality, sides taking turns, automation, bots) | `tests/conformance/rules`, `…/custom-games` |
| Endings or side names the shared screens cannot show | `tests/conformance/rules/presentation` |
| A game record with the wrong people, result, clock or moves | `tests/conformance/history/game-record` |
| A game depending on another game or a registry; a framework package depending on a game | the package's `lint` (`gameViolations`) |
| A game importing a framework module outside its `gameApi` | the package's `lint` (`gameApiViolations`) |
| Framework code spelling a game id | the package's `lint` (`gameIdentityViolations`) |

## 6. Prove it

```sh
bunx turbo run tc lint test --filter=@libs/race-shared-ts --filter=@libs/race-client-ts --filter=@libs/race-harness-ts
bunx turbo run test test:contract test:contract:0 test:contract:1 \
  test:contract:2 test:contract:3 test:contract:4 test:spec \
  --filter=@libs/games-harness-ts                              # shared suites and isolation proof
bunx turbo run test:spec --filter=@libs/race-harness-ts         # the game's own rules
bun verify
```

`@libs/games-harness-ts`'s `test` prints the matrix with the new row
(`game-conformance-matrix.test.ts`).
