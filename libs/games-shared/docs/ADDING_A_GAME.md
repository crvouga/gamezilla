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
| | `race-game-client.tsx` | `raceGameClient = defineGameClient({ … })`. |
| `libs/race-harness` (harness) | `race-playable.ts`, `race-harness-game.ts` | `RACE_PLAYABLE: PlayableGame` (label, shared definition, fixtures) and `RACE_HARNESS_GAME: HarnessGame` (adds the client) — the conformance adapter. |
| | `tests/` | The game's own rules specs and regressions. |
| `specs/race/` | features, glossary | The game's own rules in its own words (a `spec:` commit). |

Every package declares `"game": "race"` in its `package.json`; it may
depend on the framework and its own packages, never on another game or a
registry.

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
    // matchmaking: { clockNamespace: 'race/', notice: raceNoticeText },
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
  id: 'race',
  title: 'Race',
  caption: 'Count to five first',
  subtitle: () => <Trans>Take turns counting on.</Trans>,
  presentation: { name: () => t`Race`, canFlip: false, Board: RaceBoard, sideLabel, endingDescription, endingLabel, timeoutDrawDescription },
});
```

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
    // Seven moves: the victory every custom-game model follows.
    firstSideVictory: ['step', 'step', 'step', 'step', 'step', 'step', 'step'],
    refusedOpenings: ['back', ''],
  },
};

// libs/race-harness/src/race-harness-game.ts — the shared suites' adapter.
export const RACE_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...RACE_PLAYABLE,
  client: raceGameClient,
});
```

That is all. The game is now enrolled automatically:

- `specs/games/*.feature` runs for it wherever it offers what a feature
  shows, each scenario its own test named `<scenario> [race]`, and so do the
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
| A capability without what it needs, a placeholder for one not offered | type checking (`TurnGameCapabilities`) |
| An unknown capability, a duplicate bot difficulty, an id that is not a slug | `defineTurnGame`, when the module loads |
| A clock namespace other than `'<id>/'`, a starting position another game recognizes, a duplicate id | `createTurnGames`, at registration |
| A hand-built definition skipping the shared sessions | type checking (only `defineTurnGame` makes a `TurnGameDefinition`) |
| A screen key that is not a slug, is declared twice or belongs to the platform | `defineGameClient` |
| Registries that disagree, a game missing from `HARNESS_GAMES` | `assertMatchingGameIds`, `game-enrollment.test.ts` |
| Fixtures the game's rules contradict | `assertHarnessGame` |
| Rules that break a shared law (replay, isolation, legality, bots) | `tests/conformance/rules`, `…/custom-games` |
| A game depending on another game or a registry; a framework package depending on a game | the package's `lint` (`gameViolations`) |
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
