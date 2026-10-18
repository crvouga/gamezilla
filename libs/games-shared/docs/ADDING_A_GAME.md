# Adding a game

A game supplies only what makes it unique: its rules, its board, its copy,
the gesture that plays an action on its board, and the known examples its
tests are held to. The framework owns everything around them and holds the
game to every shared specification and suite for what it offers. How the
framework is built: [`GAME_FRAMEWORK.md`](GAME_FRAMEWORK.md).

The complete, working example of everything below is the test-only
reference game,
[`counting-race-game.tsx`](../../games-harness/tests/reference-game/counting-race-game.tsx).

## 1. The game's packages

For a game with id `race` (a lowercase slug; it is the game's wire id):

| Package (`"game": "race"`) | File | Holds |
| --- | --- | --- |
| `libs/race-shared` (isomorphic) | `race-rules.ts` | `GameRules`: `id`, `recognizes`, `initial`, `play`, `replay`, `legal`, `canWin`, `moves`. Positions and actions are opaque strings; `recognizes` accepts only this game's positions. |
| | `race-game.ts` | `raceGameShared = defineTurnGame({ … })` — the registration. |
| `libs/race-client` (client) | `race-board.tsx` | The board: renders a position, calls `onAction`, prefixes its controls with the `testId` it is given. |
| | `race-game-client.tsx` | `raceGameClient = defineGameClient({ shared: raceGameShared, … })`. |
| `libs/race-harness` (harness) | `race-playable.ts`, `race-harness-game.ts` | `RACE_PLAYABLE: PlayableGame` (label, shared definition, fixtures) and `RACE_HARNESS_GAME: HarnessGame` (adds the client) — the conformance adapter. |
| | `tests/` | The game's own rules specs and regressions. |
| `specs/race/` | features, glossary | The game's own rules in its own words (a `spec:` commit). |

Every package declares `"game": "race"` in its `package.json`; it may
depend on the framework and its own packages, never on another game or a
registry.

### What a game may import

A game imports only the framework's public modules, each framework
package's `"gameApi"` list. The package's `lint` refuses anything else,
in source, tests and steps alike (the full map and the reasons are in
[The public API](GAME_FRAMEWORK.md#the-public-api)):

| From | A game imports |
| --- | --- |
| `@pkgs/turn-game-shared` | `game-rules`, `game-presentation`, `game-automation`, `game-puzzles` |
| `@libs/game-session-shared` | `turn-game-definition` |
| `@libs/game-menu-client` | `game-client` |
| `@libs/game-puzzle-shared` (a game offering puzzles) | `puzzle-catalogue`, `sub`, `puzzle-link`, `completion`, `hint-stage`, `solve-status` |
| `@libs/game-puzzle-client` (a game offering puzzles) | `puzzle-client`, `personal-puzzle-stats-screen` |
| `@libs/spaces-shared` | `game` (only for a game with its own room behaviour) |
| `@libs/game-session-harness` (its `-harness`) | `harness-game`, `known-puzzles`, `game-system`, `game-navigation`, `space-game-choice`, `custom-game-ui`, `custom-game-controls`, `custom-game-lineup`, `custom-game-moves`, `custom-game-screen`, `custom-game-reads`, `custom-game-history`, `puzzle-session-probe`, `puzzle-fixtures`, `puzzle-screen`, `puzzle-records`, `puzzle-moves`, `puzzle-room-probe` |
| `@libs/game-matchmaking-harness` (its `-harness`) | `matched-game-world`, `matched-game-app.steps`, `opponent-seeking`, `multiplayer-board`, `multiplayer-review`, `multiplayer-game-record`, `multiplayer-time`, `matched-game-fixtures` |

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

```ts
// libs/race-shared/src/race-game.ts
import { defineTurnGame } from '@libs/game-session-shared/turn-game-definition';

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
// libs/race-client/src/race-game-client.tsx
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

### Offering puzzles

Puzzles are offered by a part on each side, and nothing else changes:

- **Shared** — `capabilities.puzzles` (above): the namespace `'race/'`,
  `content.validate`, `marks`, `isCell`, optionally `judge` and
  `content.positionKey`.
- **Client** — `puzzles` in `defineGameClient`, a `GamePuzzlesClient`
  (`@libs/game-puzzle-client/puzzle-client`): `Board(props)` draws the
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
  `upsertCatalogueRows` (`@libs/game-puzzle-shared/puzzle-catalogue`),
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
  `themes` offers, and offer one theme no known puzzle has. That is
  all a game supplies: every puzzle suite and specification, its
  orchestration and assertions and the faulty copies that prove them are
  the framework's.

A game offering puzzles also wires its puzzle stats outside any space,
as chess's `personal-chess-stats-client` does: a route rendering
`PersonalPuzzleStatsScreen` and a Settings row marked
`Handles.settingsPuzzleStats(<game id>)` (a watcher reads their own stats
there whatever the host's connection).

The platform then offers Puzzle and Puzzle stats among the game's
choices, the feed and its settings, ratings and feed settings of the
game's own, review, watchers' suggestions, the puzzle link and the
conformance puzzle suite.

Then add one entry to each registry — the only edits outside the game's
packages besides workspace setup (step 4):

1. `libs/games-shared/src/game-plugins.ts`: `raceGameShared` in `GAME_DEFINITIONS`.
2. `libs/games-client/src/game-plugins.client.ts`: `raceGameClient` in `GAME_CLIENT_DEFINITIONS`.
3. `libs/games-harness/src/harness-games.ts`: `RACE_HARNESS_GAME` in `HARNESS_GAMES`.

## 3. Supply the conformance adapter

```ts
// libs/race-harness/src/race-playable.ts — what any driver needs to play
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
    // the rules laws check that both sides can always win.
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

// libs/race-harness/src/race-harness-game.ts — the shared suites' adapter.
export const RACE_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...RACE_PLAYABLE,
  client: raceGameClient,
  // Only for a game offering finding an opponent and history: its game
  // record read back in its own format (names, result, clock choice, moves),
  // written without the game's code.
  // readRecord: readRaceRecord,
});
```

That is all. The game is now enrolled automatically:

- `specs/games/*.feature` runs for it wherever it offers what a feature
  shows (and, for a feature needing a trait such as a side that cannot
  win, wherever its fixtures show it), each scenario its own test named
  `<scenario> [race]`, and so do the
  `specs/games/` models (each trace `<trace> [race]`), decision tables,
  structures and objectives;
- `libs/games-harness/tests/conformance/rules/` holds its rules to the laws
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
| A client package using Lingui macros in `LINGUI_CATALOG_SOURCES` (`libs/tools/scripts/lingui-scope.ts`) and the `@libs/tools#ci:i18n` inputs | the package's `lint`, `ci-i18n.test.ts` |
| Solid lint scope (`libs/tools/port/solid-scope.json`) | the package's `lint` |
| `specs/race/` listed in `specs/conformance.yaml` contexts and the context map (`specs/README.md`) | `@libs/tools#ci:conformance`, `bun spec:check` |
| A harness running `specs/race/` declares `specDomains`, `specParts` and its parts in `apps/product/scripts/ui-quality/sources.json` | `ui-quality-graph.test.ts`, `ci-load.test.ts` |

A game's own Gherkin parameter types join `libs/harness/src/parameter-types.ts`.

## 5. What fails early

| Mistake | Fails at |
| --- | --- |
| A capability without what it needs, an unknown capability, a placeholder (`history: undefined`) for one not offered, finding an opponent without history | type checking (`TurnGameCapabilities`), and `defineTurnGame` when the module loads |
| A duplicate bot difficulty, an id that is not a slug | `defineTurnGame`, when the module loads |
| A clock or puzzle namespace other than `'<id>/'` (only the `GAME_PLATFORM_NAMESPACE` game keeps `''`), a starting position another game recognizes, a duplicate id | `defineTurnGame` and `createTurnGames`, at registration |
| Puzzles without `content.validate`, `marks`, `isCell` or a namespace | type checking (`PuzzlesCapability`), and `defineTurnGame` when the module loads |
| A game offering puzzles whose client has no `puzzles` part (with its `Board`), or a `puzzles` part for a game offering none | type checking (`GameClient`), `defineGameClient` when the module loads, `assertMatchingGameIds` and `assertHarnessGame`, each naming the fix |
| A catalogue puzzle outside the game's namespace, in a position the game does not recognise, or refused by its `content.validate` | `admitCataloguePuzzle`, which no row skips |
| A hand-built or copied definition or client | type checking (only `defineTurnGame` makes a `TurnGameDefinition`, only `defineGameClient` a `GameClientRegistration`), and the registries when they load |
| A screen key that is not a slug, is declared twice or belongs to the platform (`puzzle`, `stats`, `stats-review`, `custom-game`, `multiplayer`, `history`, `settings`, `choices`) | `defineGameClient` |
| A client missing, extra or out of order | `assertMatchingGameIds`, naming the entry to fix |
| A game missing from `HARNESS_GAMES` (or there but not registered) | the conformance plan (`game-conformance-matrix.test.ts`) |
| Fixtures the game's rules contradict (a known puzzle's line, labels, solver, wrong, refused or opponent's move included), ids that differ between the definitions, a game offering puzzles without known puzzles (or naming them without offering them), none of two solver moves, a known puzzle outside its namespace | type checking (`GameFixtures`), and `assertHarnessGame` |
| A puzzle its validation refuses or another game's it accepts, a line its judge does not follow to the solve, a wrong move judged otherwise, a legal move judged illegal, marks that name no cell, a board its automation cannot play the solution on | `tests/conformance/puzzles` |
| Rules that break a shared law (replay, isolation, legality, automation, bots) | `tests/conformance/rules`, `…/custom-games` |
| Endings or side names the shared screens cannot show | `tests/conformance/rules/presentation` |
| A game record with the wrong people, result, clock or moves | `tests/conformance/history/game-record` |
| A game depending on another game or a registry; a framework package depending on a game | the package's `lint` (`gameViolations`) |
| A game importing a framework module outside its `gameApi` | the package's `lint` (`gameApiViolations`) |
| Framework code spelling a game id | the package's `lint` (`gameIdentityViolations`) |

## 6. Prove it

```sh
bunx turbo run tc lint test --filter=@libs/race-shared --filter=@libs/race-client --filter=@libs/race-harness
bunx turbo run test test:spec --filter=@libs/games-harness   # every shared suite, now also for race
bunx turbo run test:spec --filter=@libs/race-harness         # the game's own rules
bun check-pr
```

`@libs/games-harness`'s `test` prints the matrix with the new row
(`game-conformance-matrix.test.ts`).
