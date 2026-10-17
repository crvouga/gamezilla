# Adding a game

A game supplies only what makes it unique: its rules, its board, its
copy and the moves its tests play. The platform owns everything around
them — the game choice, the game's choices, custom games with people and
bots, finding an opponent, turns, clocks, history and review, space-wide
navigation, links, notices, permissions, and the shared specifications and
contract suites. Nothing in the platform names a game; games never know
each other; three registries list them.

Product behaviour every game shares is specified once in
[`specs/games/`](../../../specs/games/) and runs once per game that offers
it. A game's own rules live in its own context, `specs/<game>/`.

## The formula

For a game with id `race` (use the repository's naming rules):

| Package | File | What it holds |
| --- | --- | --- |
| `libs/race-shared` (`"game": "race"`) | `race-rules.ts` | `GameRules`: `initial`, `play`, `legal`, `replay`, `recognizes`, `choose` (bots), `moves`, `record`. Positions and actions are opaque strings the platform never parses. |
| | `race-game.ts` | `raceTurnGame: RegisteredTurnGame` (rules, clock namespace `'race/'`, notice text, `capabilities`) and `raceGameShared` (`id`, `turnGame`, `automation`, `roomCapabilities: [GAME_ROOM_CAPABILITY]`, empty routers). |
| | `race-automation.ts` | `GameAutomation<Driver>`: `choose` and `perform(ui, board, action)` — the one gesture that plays an action on a board. Synthetic users, journeys and every shared suite use it. |
| `libs/race-client` (`"game": "race"`) | `race-board.tsx` | The board: renders a position, calls `onAction`, prefixes its controls with the `testId` it is given. |
| | `race-presentation.tsx` | `GamePresentation`: name, `Board`, side labels, ending descriptions. |
| | `race-game-client.tsx` | `defineGameClient({ id, title, caption, subtitle, instructions, presentation })`. Optional: `choices` / `screens` / `settings` for the game's own screens, `Frame` for data they share, `SessionEffects`. |
| `libs/race-harness` (`"game": "race"`) | `race-harness-game.ts` | `HarnessGame`: the shared and client definitions, any extra slice, and `firstSideVictory` (moves after which the first side has won). |
| | `tests/` | Only the game's own specs and regressions, in a world from `gameSystem('race', [RACE_HARNESS_GAME])`. |
| `specs/race/` | features, glossary, model | The game's own rules in its own words. |

Then register it — the only edits outside the game's packages:

1. `libs/games-shared/src/game-plugins.ts`: append `raceGameShared` to `GAME_DEFINITIONS`.
2. `libs/games-client/src/game-plugins.client.ts`: append `raceGameClient` to `GAME_CLIENT_DEFINITIONS`.
3. `libs/games-harness/src/harness-games.ts`: append `RACE_HARNESS_GAME` to `HARNESS_GAMES`.
4. The new packages' paths in the root `tsconfig.json` / `tsconfig.base.json`, Lingui catalog sources (`libs/tools/scripts/lingui-scope.ts` and the `@libs/tools#ci:i18n` inputs), the Solid lint scope, and `specs/conformance.yaml`'s contexts.

[`counting-race-game.tsx`](../../games-harness/tests/counting-race-game.tsx)
is a complete, test-only game in one file: the smallest working example of
every contract above.

## Capabilities

`RegisteredTurnGame.capabilities` lists what the platform offers for the
game; anything not listed is absent everywhere (no menu entry, refused by
the room and the server), never a disabled placeholder.

| Capability | The platform then provides | The game must already supply |
| --- | --- | --- |
| `custom-games` | Custom games: sides, people, bots and difficulty, invitations, readiness, clocks, resignation, draws, rematches, offline solo play, review | `GameRules` (bots: `choose`, `botDifficulties`), a board |
| `matchmaking` | Finding an opponent at a clock choice, matched games, ratings per speed, turn and result notices, rematches, the multiplayer link | the clock namespace, notice text |
| `history` | History and statistics of the game's custom and matched games, replay | `replay`, `moves`, `record` |

Every requirement is part of the types above, so a declared capability
cannot lack its implementation.

## The game's own screens

The game's choices are a shared screen: the game's own choices first, then
the shared ones in a fixed order, then the game's settings. Navigation is
space-wide (everyone in the space is shown the screen opened in it) through
`useGameScreen()`; a game screen calls `gameScreen.show('<screen>')` or
`gameScreen.showChoices()`. `defineGameClient` refuses, when the game is
defined, a screen key that is not a lowercase slug, is declared twice, or
belongs to the platform (`choices`, `custom-game`, `multiplayer`,
`history`, `settings`). Copy is passed as render functions
(`subtitle: () => <Trans>…</Trans>`), never built when the module loads.

## What enforces it

| Rule | Check |
| --- | --- |
| A game never depends on another game; only a game registry (`"gameRegistry": true`) composes games; a package named for a game declares it | `gameViolations` in `libs/tools/scripts/package-boundaries.ts`, run by every package's `lint` |
| Platform source never imports a concrete game | `import-game-implementation.grit` |
| Every registered game is enrolled, with production's own definitions | `libs/games-harness/tests/game-enrollment.test.ts` |
| An adapter's victory is legal and won by its last move | `assertHarnessGame` |
| Every shared scenario runs for every game offering what it shows | `defineScenarioVariants` in `libs/games-harness/tests/steps/index.ts` (a failure names the game) |
| Shared match authority, history and session contracts hold for every game | `libs/games-harness/tests/*.contract.test.ts` |
| A game no shared code knows is offered, played and counted | `libs/games-harness/tests/counting-race-game.test.ts` |

## Proving a new game

```sh
bunx turbo run tc lint test --filter=@libs/race-shared --filter=@libs/race-client --filter=@libs/race-harness
bunx turbo run test test:spec --filter=@libs/games-harness   # every shared scenario, now also for race
bunx turbo run test:spec --filter=@libs/race-harness         # the game's own rules
bun spec:check && bun atlas:lint
bun check-pr
```

## Existing records and protocol identities

Durable names keep their established identities even where they now serve
every game: SQL tables (`chess_multiplayer_*`, `chess_opponent_searches`),
room namespaces (`chess/custom`, `chess-custom-cmd`, `chess-match`), query,
mutation, outbox and telemetry names, the seat tokens `white` / `black` (the
first and second side) and the record fields `fen` / `uci` / `san` (position,
action, label). Renaming them would change stored histories and pending
offline mutations. Chess keeps the unprefixed clock namespace of its stored
searches and ratings; every later game uses `<id>/`. The space-wide game
screen (`games/screen`, `games-cmd/show-screen`) is a platform identity.
