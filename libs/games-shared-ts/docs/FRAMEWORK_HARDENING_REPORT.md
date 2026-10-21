# Framework hardening report

What the shared game framework promises, what enforces each promise, how
much of chess's and Connect Four's behaviour became the framework's, and
what is still open. It covers branch `refactor/shared-game-architecture`.
Sections 1–9 were measured at `7455fc070` (91 commits on `main..HEAD`).
The gate ran up to `7e70d865e`, which adds two fixes the gate found (§10). Every number
comes from a command listed in [Validation](#10-validation), and every table
cites the code or commit it was derived from. The design itself is
[`GAME_FRAMEWORK.md`](GAME_FRAMEWORK.md), and adding a game is
[`ADDING_A_GAME.md`](ADDING_A_GAME.md).

`main` gained 16 commits after the branch split. Diff figures therefore use
`main...HEAD` (the merge base), so they count only this branch's changes.

## 1. Public API map

A game may import only the modules its framework packages list in their
`package.json` `"gameApi"`. `gameApiViolations` in
`libs/tools-harness-ts/scripts/package-boundaries.ts` refuses anything else, in source,
tests and types alike. The table was read with `jq .gameApi` on each manifest.

| Layer | Package | Public modules (`gameApi`) |
| --- | --- | --- |
| Core contracts | `@pkgs/turn-game-shared-ts` | `game-rules` (`GameRules`, `TurnGameCapabilities`, `GameBots`, `MatchmakingCapability`, `HistoryCapability`, `GameSide`, `createTurnGames`), `game-presentation`, `game-automation` |
| Capability contracts | `@pkgs/turn-game-shared-ts` | `game-puzzles` (`PuzzlesCapability`, `PuzzleRecord`, `PuzzleMarks`); the other capability contracts live in `game-rules` |
| | `@libs/game-puzzle-client-ts` | `puzzle-client` (`GamePuzzlesClient`, `PuzzleBoardProps`, `PuzzleAttempt`, …); personal stats are registered by framework composition |
| | `@libs/game-puzzle-shared-ts` | `puzzle-catalogue`, `sub`, `puzzle-link`, `completion`, `hint-stage`, `solve-status` |
| Extension points (composition) | `@libs/game-session-shared-ts` | `turn-game-definition` (`defineTurnGame`) |
| | `@libs/game-menu-client-ts` | `game-client` (`defineGameClient`: `shared`, `presentation`, `puzzles`, `choices`, `screens`, `settings`, `Frame`, `SessionEffects`) |
| | `@libs/spaces-shared-ts` | `game` (`GameOwnRoom`, `GameCommandContext`, `mergeGameRouterEntries`) |
| Extension points (conformance) | `@libs/game-session-harness-ts` | 27 modules: `harness-game` (`HarnessGame`, `GameFixtures`, `assertHarnessGame`), `known-puzzles`, `game-system`, `game-navigation`, `space-game-choice`, 7 `custom-game-*` drivers and reads, 15 `puzzle-*` drivers, reads and fixtures (`jq .gameApi`) |
| | `@libs/game-matchmaking-harness-ts` | 8 modules: `matched-game-world`, `matched-game-app.steps`, `matched-game-fixtures`, `opponent-seeking`, `multiplayer-board`, `multiplayer-review`, `multiplayer-game-record`, `multiplayer-time` |
| Internal only (`"gameApi": []`) | `@pkgs/turn-game-client-ts`, `@libs/game-session-client-ts`, `@libs/game-session-server-ts`, `@libs/game-matchmaking-shared-ts`, `@libs/game-matchmaking-client-ts` | Platform screens, consumers, commands, storage |
| Registries (`"gameApi": []`, `"gameRegistry": true`) | `@libs/games-shared-ts`, `@libs/games-client-ts`, `@libs/game-catalog-shared-ts`, `@libs/games-harness-ts` | Composition roots only. A game never depends on one (`gameViolations`). |

The internal implementation includes the stored state, transport clients,
room and match-room details, probes, fixture transactions and UI
controllers. GAME_FRAMEWORK.md § "The public API" enumerates it.

## 2. API decisions and guarantees

| Decision | Enforced at | Executable checks |
| --- | --- | --- |
| **One integration path.** `defineTurnGame` / `defineGameClient` return branded values. A spread copy or a hand-built object is a type error and is refused when the registry loads. | Type check and module load (`assertTurnGameDefinitions`, `assertGameClientDefinitions`, `assertHarnessGame`) | `libs/game-session-shared-ts/tests/turn-game-contract.test.ts` "a definition defineTurnGame did not make is refused at type checking and by the registry"; `libs/game-menu-client-ts/tests/game-client-contract.test.ts` (the same for clients); `libs/games-harness-ts/tests/game-enrollment.test.ts` "each enrolled game is the very definition production registers" |
| **Capabilities are enforced at type and runtime.** No unknown capability, no placeholder. A `puzzles` client part exists exactly when the game offers puzzles. | `TurnGameCapabilities` type, `defineTurnGame` (`turn-game-definition.ts:112,116`), `defineGameClient`, `assertMatchingGameIds` | `turn-game-contract.test.ts` (4 capability tests); `game-client-contract.test.ts` "a game offering puzzles supplies its puzzles part…" / "…offering no puzzles has no puzzles part…"; `pkgs/turn-game-shared-ts/tests/catalog.test.ts` "a capability is offered only by a game that supplies it"; `libs/games-shared-ts/tests/game-plugin-contract.test.ts` |
| **Matchmaking requires history** (`CAPABILITY_REQUIRES`, `game-rules.ts:141`) | Type error, and `createTurnGames` (`game-rules.ts:185`) | `turn-game-contract.test.ts` "finding an opponent without history is refused at type checking and when defined"; `catalog.test.ts` "finding an opponent is refused without history…" |
| **Namespaces.** Each game's clock and puzzle namespace is `'<id>/'`. The unprefixed `''` belongs only to `GAME_PLATFORM_NAMESPACE` (`'chess'`, `game-matchmaking-shared/src/durable-names.ts:10`). | `createTurnGames` (`game-rules.ts:211`), `admitCataloguePuzzle` | `catalog.test.ts` (4 namespace tests); `turn-game-contract.test.ts` "only the platform's durable game keeps the unprefixed clock namespace" and the puzzle analogue; `reference-game/faulty-games.test.ts` (puzzle namespace `""` / `chess/`) |
| **The `gameApi` boundary** | `lint` of every game package | `libs/tools-harness-ts/scripts/package-boundaries.test.ts` `describe('the game API')` (5 tests); `libs/games-harness-ts/tests/probes/probe-imports.test.ts` |
| **Framework-owned lifecycles.** Platform code never names, imports or branches on a game. | `gameViolations`, `gameIdentityViolations` (`package-boundaries.ts:313,398`), Biome plugin `libs/tools-harness-ts/biome-plugins/import-game-implementation.grit` | `package-boundaries.test.ts` `describe('game isolation')` (6) and `describe('game identity')` (3); `game-plugin-contract.test.ts` "shared and client registries must line up by id, saying which entry to fix" |

The semantics table (who calls what, and who commits, deduplicates and
recovers) is in GAME_FRAMEWORK.md § Semantics. This report does not repeat it.

## 3. Ownership and migration

**Specifications.** There are 18 `spec:` commits (`01a8f1eb8` … `e664fbf60`).
Counts from `git diff --name-status -M main...HEAD -- specs/`:

| Movement | Files |
| --- | --- |
| Renamed `specs/chess` → `specs/games` | 43 (25 feature, 11 qnt, 4 dmn, 2 openslo yaml, 1 als) |
| Deleted from `specs/chess` (rewritten for every game) | 52 (45 feature, 4 qnt, 2 als, 1 yaml) |
| Deleted from `specs/connect-four` | 3 features |
| Added in `specs/games` | 74 (65 feature, 5 qnt, 2 als, 1 openslo yaml, 1 `ubiquitous-language.yml`) |

| Directory | `main`: features / qnt / scenarios | HEAD: features / qnt / scenarios |
| --- | --- | --- |
| `specs/chess` | 104 / 21 / 895 | 34 / 7 / 190 |
| `specs/connect-four` | 7 / 1 / 28 | 4 / 1 / 10 |
| `specs/games` | 0 / 0 / 0 | 90 / 16 / 744 |

Scenario counts here are `Scenario:`, `Scenario Outline:` and `Example:` header
lines. Across all three directories, 923 headers on `main` became 944 at
HEAD.

**Known-bug regressions.** `git diff --name-status main...HEAD --
libs/tools-harness-ts/goal/known-bugs` shows 116 modified and 6 added files. Their
`regressionTest` homes moved as follows (`main` vs HEAD, read with `jq`):

| Old home → new home | Count |
| --- | --- |
| `chess-root-harness` → `games-harness` | 51 |
| `specs/chess` → `specs/games` | 32 |
| `chess-puzzle-client` → `game-puzzle-client` | 6 |
| `chess-puzzle-shared` / `chess-puzzle-harness` → `games-harness` | 6 |
| `chess-root-harness` / `chess-puzzle-*` / `chess-matchmaking-harness` → `game-matchmaking-shared`, `game-puzzle-shared`, `game-matchmaking-harness` | 8 |
| `connect-four` (spec, shared) → `specs/games`, `games-harness` | 2 |
| Stayed game-specific or infrastructure (`connect-four-harness` 4, `chess-root-harness` 3, `runtime-harness` 4) | 11 |

In total, 72 now point at shared code and 33 at shared specifications. New
on this branch: `custom-game-mover-credited-win` (`game-session-shared`),
`matched-game-sweep-ends-a-game-twice` (`game-matchmaking-shared`),
`puzzle-link-namespace-undecoded` (`game-puzzle-shared`),
`chess-play-accepts-noncanonical-actions` (`chess-rules-shared`),
`disc-drop-board-label-not-in-name`, and
`known-bug-gate-rejects-shorthand-quint-actions`.

Commits that name a promoted counterexample and its new home: `f6d751eb6`
(`custom-game-ended-space-unobservable` → `conformance/custom-games/space-ending`),
`8f9f011ac` (`game-session-inconsistent-retained-history` → `retained-history`),
`441a74586` (`game-session-ending-descriptions-lost` → `conformance/rules/presentation`),
`83cdb6539` (`chess-space-query-tombstone-filter` → `game-matchmaking-harness`),
`1bbcd7ce7` (`chess-finished-game-clock-resets` → `game-matchmaking-shared`),
`dc15000ea` (`puzzle-solved-review-resumes`, `puzzle-attempt-clock-identity-collision`
→ `conformance/puzzles/`), and `8c761c311` (matchmaking, offline-board and
invitation-name counterexamples → `conformance/matchmaking/finding-an-opponent`,
`custom-games/offline-solo-board`, `custom-games/invitation-names`).

**Exact counterexamples were kept.** The repository has 139 unique
`// regression:` ids on `main` and 143 at HEAD. By marker, 99 package+id
pairs sit in shared homes (`games-harness` 72, `game-matchmaking-harness` 7,
`game-puzzle-client` 6, `game-puzzle-shared` 5, `game-matchmaking-shared` 4,
`game-session-shared` 3, `game-session-harness` 2). Each shared one now runs
once per game its area binds (§4), which generalises the literal input
without dropping it. Quint binding `regressions` number 51 at HEAD, the same
as on `main`: 38 in 16 `games-harness` bindings (replayed per game) and 13
in `chess-root-harness`.

**Retired copies.** `9e769994c` deleted `libs/chess-custom-game-harness`
and `libs/chess-matchmaking-harness` (51 files, +389/−913), and `e813ce154`
dropped their dependencies.
`connect-four-root-client` and `connect-four-board-client` became
`connect-four-client`.

**Canonical sources.** Shared behaviour lives in `specs/games/` (90
features, 16 qnt, 4 dmn, 3 als, 3 openslo). The shared code suites are in
`libs/games-harness-ts/tests/conformance/<area>/`. The laws are in
`libs/game-session-harness-ts/src/game-{rules,capability,puzzle}-laws.ts`.
The planner is `libs/games-harness-ts/src/game-conformance.ts`.

**What stays game-specific, and why.** `specs/chess` keeps 34 features
(board orientation, promotion, castling, en passant, algebraic notation,
PGN, keyboard moves by square, spoken moves, chess draws, Lichess import,
saved puzzles, the Puzzle Assistant and its model). `specs/connect-four`
keeps 4 (its rules, bots, accessibility, health). They name a game's own
rules or board, or need a contract that does not exist yet (a keyboard
gesture or a spoken label for an action, per GAME_FRAMEWORK.md § Known
limits).

## 4. Source reuse

Computed with `requiredGames(sharedSpecifications(), CONFORMANCE_GAMES)` from
`@libs/games-harness-ts/game-conformance`, with `sliceReplays` over
`tests/quint/replays.json`, and by calling the law functions (the
`/tmp/fhr-reuse/*.ts` scripts in §10). Every model's planned `variants`
equalled its required-game count.

| Layer | Unique authored | chess | Connect Four | counting race | Generated instances | Generated ÷ unique |
| --- | --- | --- | --- | --- | --- | --- |
| Feature files | 90 | 90 | 53 | 56 | 199 | 2.21 |
| Runnable scenarios (722 plain + 73 outline rows) | 795 | 795 | 521 | 455 | **1771** | **2.23** |
| Quint models | 16 | 16 | 11 | 10 | 37 | 2.31 |
| Model replays, `pr` profile | 72 | 72 | 55 | 53 | 180 | 2.50 |
| Model replays, nightly | 936 | 440 | 333 | 271 | 1044 | 1.12 |
| DMN, Alloy, OpenSLO | 10 | 10 | 7 | 6 | 23 | 2.30 |
| Shared code suites | 19 files (60 hand-written tests + 7 law-driven files) | 92 | 35 | 81 | 208 tests | — |

The nightly ratio is low by design. Traces outside a model's cover set are
dealt round-robin among the games (`runsOfTrace`). Only cover traces,
regressions and determinism checks multiply per game.

**Per-game fixture size** (same-package import closure of the entry file):

| Game | Production definitions | Harness adapter and fixtures |
| --- | --- | --- |
| chess | `chess-sub-shared/src/chess-game.ts` 62 lines + `chess-root-client/src/chess-game-client.tsx` 112, plus rules and puzzles in other chess packages | `chess-root-harness/src/chess-harness-game.ts` closure: 9 files, 938 lines (`chess-playable.ts` fixtures 154) |
| Connect Four | `connect-four-shared/src/connect-four-game.ts` 7 files, 447 lines; client 3 files, 114 | `connect-four-harness-game.ts` closure: 6 files, 320 lines (fixtures 28, playable 19) |
| counting race | 381 lines (see §8) | 265 lines (see §8) |

## 5. Actual matrix

Cells read features / scenario runs / shared code-suite tests. The source is
`requiredGames` plus the law counts in §4. A feature needing several
capabilities is counted under each. "Required layers" are the spec kinds
and code suites that bind the cell.

| Game | rules | custom-games | matchmaking | history | puzzles |
| --- | --- | --- | --- | --- | --- |
| chess | 0 / 0 / 16 | 27 / 208 / 9 | 32 / 330 / 9 | 4 / 42 / 2 | 35 / 265 / 56 |
| Connect Four | 0 / 0 / 15 | 25 / 201 / 9 | 30 / 325 / 9 | 4 / 42 / 2 | — (not offered) |
| counting race (reference, test-only) | 0 / 0 / 15 | 24 / 197 / 9 | — (not offered) | 1 / 6 / 1 | 33 / 259 / 56 |
| probe `puzzle-only` (not enrolled) | laws pass | — | — | — | laws pass, solved on the shared screen |
| probe `setup-race`, `misere-tally` (not enrolled) | laws pass | inherited by capability | — | — | — |
| probe `double-turn` (not enrolled) | refused by the turn law | — | — | — | — |
| probe `solo-count` (not enrolled) | refused by the turn law | — | — | — | refused by `assertHarnessGame` |

The suite counts printed by `tests/game-conformance-matrix.test.ts` (10
pass, 0 fail):

```text
| game          | rules    | custom-games | matchmaking | history  | puzzles   |
| chess         | 2 suites | 41 suites    | 44 suites   | 9 suites | 51 suites |
| Connect Four  | 2 suites | 39 suites    | 42 suites   | 9 suites | —         |
| counting race | 2 suites | 37 suites    | —           | 2 suites | 49 suites |
```

**Required layers.**
- `rules`: code suites only (the rules and presentation laws).
- `custom-games`, `matchmaking`, `puzzles`: features, qnt, dmn, als, openslo and code suites.
- `history`: features and qnt for chess and Connect Four. The counting race gets `game-history.feature` and `cancelled-game` only, because every history model also needs matchmaking and `game-record` yields no law without matched games.

**Applicability.**
- An offered capability makes the cell apply.
- `secondSideCannotWin` applies to chess only. Connect Four and the counting race skip `custom-game-cannot-win`, and Connect Four also skips `matched-game-cannot-win`.
- `drawByRules` applies to chess and Connect Four, which run `matched-game-rules-draw`.
- `wonAnotherWay` applies to chess only, which runs `puzzle-objective` (4 scenarios).
- Multi-capability features: `puzzle-matched-play` covers chess, and `puzzle-custom-play` covers chess and the counting race.

**Actual results of this run.** Every cell above ran in the PR gate (§10):
- `@libs/games-harness-ts`: 41 spec parts, 31 model-check tasks (16 parts; the matched-game model in 16 phases), and the unit and conformance suites.
- `@libs/chess-root-harness-ts`: 7 spec parts and 7 model-check tasks.
- `@libs/connect-four-harness-ts`: 3 spec parts and 1 model-check task.

One gate failure fell in a matrix cell: the puzzles cell, for both chess and the counting race. It was a binding defect, fixed in `7e70d865e` (§10).

## 6. Verifier checks

All rows ran in this session, and every one passed.

| Outcome | Test (file: title) | Result |
| --- | --- | --- |
| Missing binding | `game-conformance-plan.test.ts`: "a registered game missing from the harness games fails, naming where to add it", "a harness game that is not registered fails…", "harness games out of registry order, or holding another definition, fail"; `game-enrollment.test.ts` | 12/0, 5/0 |
| Missing required case | "an offered capability no suite requires a case of fails" (cell status `missing`) | in 12/0 |
| Empty suite | "a suite file registering no case binds nothing, and fails", "a suite file never calling forEveryGame fails"; control: "a suite registering a case for only some of its games is not empty" | in 12/0 |
| Spec table errors | "a specification table listing an unknown capability, nothing, or only a trait fails", "a specification without an entry, and an entry without a specification, fail" | in 12/0 |
| Incorrect result attribution | `game-result-attribution.test.ts`: "no game's verdict can stand for another game's obligation", "each game's run of a shared specification is named and recorded for that game" | 4/0 |
| Per-game evidence (`libs/tools-harness-ts/conformance/variant-evidence.ts`: passed, failed, stale, required but missing, not applicable) | `libs/tools-harness-ts/scripts/conformance-report-variants.test.ts`: "one game's pass does not satisfy another game's requirement", "a failing game fails its own cell and is named", "a game whose only verdict is from another text is stale…", "every required game needs a replayed trace of its own", "a game the spec does not need is not applicable and owes nothing", "a per-game verdict without the host declaring what the spec needs decides nothing" | 11/0 |
| Order isolation | `game-order-isolation.test.ts`: "the plan and matrix are the same with the games in reverse order", "a game's verdict does not depend on which game's laws ran first", "each faulty copy is its own game…" | 4/0 |

**Faulty consumers.** These are copies of the reference game, each built through
`defineTurnGame` / `defineGameClient`, in
`reference-game/faulty-games.test.ts` (17/0) and `faulty-capabilities.test.ts`
(8/0). "Only" means `expectRefusedBy` asserts that no other law refuses the copy.

| Faulty game | Refused by |
| --- | --- |
| accepts an action it does not offer | "the known refused openings are refused" |
| replay forgets the actions | "replaying the accepted actions reproduces every position, deterministically" |
| claims another game's positions | "every position a game reaches is recognized as this game alone" |
| shows moves other than those played | "the moves shown are the accepted actions, labelled as they were played" (only) |
| still playable after its victory | "the known victory finishes the game for the first side and nothing follows it" |
| accepts a legal move under another spelling | "only a legal action is accepted, and a finished game accepts none" (only) |
| bot chooses an action not offered | "two bots play only legal actions until the game finishes" (only) |
| automation chooses an action not offered | "the automated participant only ever chooses a legal action" (only) |
| strength offered twice | `defineTurnGame` throws "a bot difficulty is offered twice"; mutated afterwards: "each strength is offered once" (only) |
| side cannot win with no line named to it | "a side cannot win only where the game names a line to it" (only) |
| rules draw with no line named to it | "its rules draw it only where the game names a line to it" |
| puzzle judge misspells the solution | "following the solution solves the puzzle…", "its wrong move is judged wrong" |
| puzzle marks off the board | "a hint, a wrong move and a suggestion name cells of its board" (only) |
| puzzle validation accepts another game's puzzle | "its content validation refuses every other game's known puzzle" (only) |
| puzzle namespace `""` or `chess/` | refused at definition (`game-rules.ts:211`) |
| known puzzles the rules contradict | `assertHarnessGame` (5 messages, e.g. "wrong move leap is a win") |
| ending without a description, reason never given, sides sharing a name, draw on time undescribed | the four presentation laws (each only) |
| record with people on the wrong sides, wrong result, another game's moves | "the game record names both people, the result, the clock choice and every move of this game" (only) |

`reference-game/known-puzzles-contract.test.ts` (4/0) holds the fixture
obligation.

## 7. Extensibility evidence

Every probe in `libs/games-harness-ts/tests/probes/` imports only `gameApi`
modules (`probe-imports.test.ts` 2/0) and is judged by the framework's own
laws and planner (`probe-verdict.ts`). No probe is in `HARNESS_GAMES` or
`CONFORMANCE_GAMES`: a grep for the probe symbols outside `tests/probes/`
matched nothing.

| Probe | Run | Outcome | Pinned by |
| --- | --- | --- | --- |
| `puzzle-only` (puzzles only) | 4/0 | supported; `solo-count` is a limitation | binds `rules`, `puzzles`; unsupported `custom-games`, `matchmaking`, `history`. `assertHarnessGame`: "the known puzzle solo-count/two-twos's solution is not its line's solver moves" |
| `turn-order` (`double-turn`) | 3/0 | limitation | the turn law alone: "the first side moves first and every action passes the turn to the other side" |
| `setup-phase` (`setup-race`) | 3/0 | supported as ordinary turns | no refusals; binds `rules`, `custom-games` |
| `results` (`misere-tally`, shared win, score) | 3/0 | the winner named by the rules is supported; a shared win or a score is a limitation | the outcome "white wins by counted to seven" (regression `custom-game-mover-credited-win`); `@ts-expect-error` on a shared win and on a score result |
| `participants` (more than two) | 1/0 | limitation | `@ts-expect-error`: a third seat; a record with more than two participants |
| `private-state` | 2/0 | limitation | `@ts-expect-error`: a board with no viewer, `legal` with no actor; three viewers read the same position |
| `play-surface` (not a chessboard) | 2/0 | supported; puzzle marks need cells | `refusals(COUNTING_RACE_GAME)` is empty; `@ts-expect-error` on a mark without a cell |

The change-impact table, verified against this branch's commits, is
GAME_FRAMEWORK.md § "Change impact":
- A game with existing capabilities touches no framework file. The evidence is Connect Four and `dc15000ea`.
- A specialised component is one game file (`973dd1afd`).
- An optional capability field touches its contract, its reader and its law (`efa1cf428`, `cc9ea727f`).
- A new capability touches contracts and internals. Puzzles took `e74e57b9b` → `907e5d0f8` → `f4b73b343` → `44df2e627` and the binding commits.

## 8. Developer experience and onboarding cost

**The minimal integration** is the counting race,
`libs/games-harness-ts/tests/reference-game/counting-race-game.tsx` (708 lines,
from `wc -l` plus section boundaries):

| Part | Lines |
| --- | --- |
| Rules and the puzzles capability (production-equivalent shared) | 150 |
| Board, puzzle board, sounds, side names (production-equivalent client) | 177 |
| `defineTurnGame` and capabilities | 25 |
| `defineGameClient` | 29 |
| **Production-equivalent total** | **381** |
| Fixtures: known victory, refused openings, 3 known puzzles (`KNOWN_RACE_PUZZLES`, `COUNTING_RACE_FIXTURES`) | 213 |
| Harness slice (stats screen, `assertHarnessGame`) | 52 |
| **Fixture and harness total** | **265** |
| Imports and header | 62 |

The surrounding tests total 729 lines: `faulty-game.ts` 95,
`faulty-games.test.ts` 329, `faulty-capabilities.test.ts` 186 and
`known-puzzles-contract.test.ts` 119. Those 381 + 265 lines inherit 56
feature files, 455 scenario runs, 10 models (53 `pr` replays), 6 other
specification artifacts and 81 code-suite tests (§4, §5).

**Actionable diagnostics** (verbatim from source):

- `turn-game-definition.ts:190`: `${registry}[${index}] (${id}) was not made by defineTurnGame — register the game's defineTurnGame(...) value itself, never a copy or a hand-built definition`
- `turn-game-definition.ts:116`: `${id}: capabilities.${key} is a placeholder — leave out a capability the game does not offer`
- `game-rules.ts:185` (`createTurnGames`): `${id}: offering ${capability} needs ${need} too (every finished matched game offers its game record) — add capabilities.${need}`
- `game-rules.ts:211`: `${id}: the unprefixed ${kind} namespace "" belongs to the platform's durable game alone — use "${id}/"`
- `harness-game.ts:187` (`assertHarnessGame`): `its definitions name different games (defineTurnGame "…", defineGameClient "…", rules "…") — give defineGameClient this game's defineTurnGame value as its shared`
- `harness-game.ts:236`: `the game offers puzzles but its client has no puzzles part — give defineGameClient puzzles: { Board, … }`
- `game-conformance.ts:381` (`planConformance`): `"${id}" is in GAME_DEFINITIONS but not HARNESS_GAMES — add its HarnessGame to HARNESS_GAMES (@libs/games-harness-ts/harness-games) so the shared suites hold it`
- `game-conformance.ts:453`: `${suite} registers no case for any game it binds (…) — add its tests inside forEveryGame, or delete it`
- `game-conformance.ts:469`: `${game} offers ${area} but no shared suite or specification requires a case of it — add a suite under tests/conformance/${area}/ or list a specs/games specification showing it in SHARED_SPECIFICATIONS`
- `load-game-plugins.ts:54` (`assertMatchingGameIds`): `GAME_CLIENT_DEFINITIONS[i] is "…" but GAME_DEFINITIONS[i] is "…" — list the clients in the order of GAME_DEFINITIONS`
- `package-boundaries.ts:364` (`gameApiViolations`): `…imports X, which is Y's own implementation, not its game API (…). A game depends on what the framework promises: use a public module, add a focused read, action or fixture helper to one, or move a test of the framework's own behaviour into the framework`
- `package-boundaries.ts:398` (`gameIdentityViolations`): `…spells the game '…': platform code receives games through the registry's ports and never names one`

One cost remains. Running a `games-harness` test file needs the package's
preload flags (`--conditions=browser --conditions=development --preload
@pkgs/bun-test-solid-client-ts/preload --preload @libs/harness-ts/preload`). A
bare `bun test <file>` fails 13 of 16 files on `react/jsx-dev-runtime`.

## 9. Known limitations and open items

- **Glossary terms await the owner's confirmation.** The spec commits `20d4e5c1a`, `0ec8b53e3`, `73a546c62`, `755f6e0da` and `ef4ad0065` each say "the person's confirmation is still asked". The terms in question:
  - the puzzle vocabulary new to Games (puzzle, known puzzle, solver, attempt, line, setup move, hint, puzzle clock, daily puzzle limit, …);
  - the feed terms moved from Chess (feed settings, history filter, rating offset, rating window, half credit, …);
  - "first result" and "return to a space";
  - "puzzle link" and the sound forms;
  - "won another way".
- **Durable chess-named stores serve every game.** These include `GAME_PLATFORM_NAMESPACE = 'chess'`, the tables `chess_multiplayer_*`, `chess_opponent_searches` and `chess_puzzle*`, the catalogue topic `system:chess_puzzles`, the room attributes `chess.puzzle.*`, the messages `chess-puzzle-play-*` and `chess-cmd`, the refusal codes `CHESS_*` and the route `/chess/puzzle/:puzzleId`. They are deliberately never renamed, because renaming would break stored histories and queued mutations (GAME_FRAMEWORK.md § Durable names). For a reader they remain a naming debt.
- **The billing spec-part change is reverted.** `3c6b2c60c` lowered `@libs/billing-harness-ts` from 24 to 23 spec parts to keep the total at 241 spec tasks; once `303e7b499` sized parts by the replays each model actually runs (games 64 → 41, chess 32 → 7), billing went back to `main`'s 24 and `docs/CI_REQUIREMENTS.md` still reads "Fits: yes".
- **`--strict-duplicates` fails.** `verify-specs.ts --strict-duplicates` exits 1 with 9 near-duplicate step pairs, all in step definitions outside `specs/`. Seven differ only by case ("Custom Game" vs "custom game") between `chess-root-harness` or `runtime-harness` and `games-harness`. The others are one `friends-harness` pair and one `games-harness` pair. It is not a gate: `@libs/tools-harness-ts#ci:specs` runs `verify-specs.ts` without the flag, and that exits 0 with 9 wording warnings. All nine phrasings are used by feature files (`specs/chess`, `specs/journeys`, `specs/spaces`, `specs/games`). Removing the pairs therefore means unifying the wording in a `spec:` commit, for example "Custom Game" against "custom game".
- **Another session's uncommitted edits break `@libs/game-puzzle-client-ts#lint`.** The files are `use-puzzle-rating-events.ts`, `use-puzzle-result-recorded.ts` and `game-puzzle-shared/src/puzzle-tables.ts`. Biome reports `use-puzzle-rating-events.ts:1:1 assist/source/organizeImports`. HEAD's committed tree passes (§10, A/B check).
- **`@libs/games-harness-ts#verify:models:10` ran over budget.** This task is `puzzle-attempt.qnt`. It took 303 s against a 300 s budget in the cold gate run, on a shared machine at load 9–17 with three solver tasks beside it. Moving it from chess shrank the model (+22/−95 lines) and left its bounds alone (`maxSteps 64`, `verifySteps 8`). Re-timed alone at load ~9, it took 10 s (a complete finite graph of 17,626 states in 9.2 s). Likewise `test:spec:20` took 310 s at load 23–25 against 113 s alone (90 pass). Both overruns were contention on a shared machine, so no budget was raised.
- **Spec scenarios share one process per part, and earlier worlds shift ids.** The spec runner uses `--no-isolate`, and with `VERIFY_TEST_CONCURRENCY=1` every file in a part runs in one process. What a world derives can therefore depend on which files ran before. Measured here: the feed's first pick, seeded by `${myId}-${attemptSeed}` through `resolvePuzzlePickOffset`, served `leap-past-four` after `matched-game-cannot-win` but `either-order` alone. `7e70d865e` fixed the one scenario this exposed. The order dependence itself remains a harness property: a step whose premise holds for only some picks will pass alone and fail in the gate.
- **Limits carried from GAME_FRAMEWORK.md and the probes:**
  - Turns must alternate.
  - There are exactly two seats.
  - A result is a winner or a draw, never a score.
  - There is no per-viewer state.
  - Puzzle lines alternate with an opponent.
  - Automation is one pointer gesture, so there is no shared keyboard move or spoken move.
  - The game models assume a 7-move first-side victory.
  - Shared suites live in one package, so any game change reruns all of shared conformance.
- **Three guarantees hold by construction but have no test yet** (GAME_FRAMEWORK.md § "Not yet proven by a test"): a redelivered notice stays dismissed, a refused bot proposal waits, and presentations are pure.

## 10. Validation

All commands ran in this session from the worktree (at `7455fc070` unless a row says otherwise), with
`main` at its current tip.

| Command | Scope | Outcome |
| --- | --- | --- |
| `git log --oneline main..HEAD`; `git rev-list --count HEAD..main` | branch history | 91 commits; `main` 16 ahead |
| `git log --oneline main..HEAD --grep '^spec:'`; `git show --name-status -M <sha>` per commit; `git diff --name-status -M main...HEAD -- specs/` | §3 spec moves | 18 spec commits; R 43, D 55, A 74 |
| `git grep -hE '^[[:space:]]*(Scenario\|Scenario Outline\|Example):' <rev> -- specs/<dir>/ \| wc -l`; `git ls-tree -r <rev>` | §3 scenario and file counts | table in §3 |
| `git diff --name-status main...HEAD -- libs/tools-harness-ts/goal/known-bugs`; `git show main:<f> \| jq .regressionTest` vs HEAD | §3 regression homes | 116 M, 6 A |
| `grep -rnoE '// regression: *[A-Za-z0-9_-]+'` over `libs/{games,game,chess,connect-four}-*`; `git grep` on `main` and HEAD | §3 counterexamples | 139 → 143 ids |
| `git show --shortstat 9e769994c e813ce154` | retired copies | 51 files, +389/−913 |
| `jq .gameApi */*/package.json` | §1 | table in §1 |
| `cd libs/games-harness-ts && bun run --conditions=browser --conditions=development --preload=@pkgs/bun-test-solid-client-ts/register /tmp/fhr-reuse/reuse.ts` (and `suites.ts`) | §4, §5: `requiredGames`, `sliceReplays`, law counts | 795 → 1771 scenario runs; 72 → 180 `pr` replays; 208 suite tests |
| `wc -l libs/games-harness-ts/tests/reference-game/*`; `bun run /tmp/fhr-reuse/closure.ts <entry>` | §4, §8 sizes | tables in §4, §8 |
| `cd libs/games-harness-ts && bun test --conditions=browser --conditions=development --preload @pkgs/bun-test-solid-client-ts/preload --preload @libs/harness-ts/preload <file>` for `game-conformance-matrix` (10/0), `game-conformance-plan` (12/0), `game-result-attribution` (4/0), `game-order-isolation` (4/0), `game-enrollment` (5/0), `reference-game/*` (1, 8, 17, 4 /0), `probes/*` (8 files, 20/0) | §5–§7 | all pass |
| `cd libs/tools-harness-ts && bun test scripts/conformance-report-variants.test.ts` (11/0), `scripts/package-boundaries.test.ts` (25/0) | §2, §6 | pass |
| `bun test` in `libs/game-session-shared-ts` (`turn-game-contract` 8/0, `independent-rules` 4/0), `libs/game-menu-client-ts` (`game-client-contract` 4/0), `libs/games-shared-ts` (`game-plugin-contract` 4/0), `pkgs/turn-game-shared-ts` (`catalog` 9/0) | §2 | pass |
| `bun run libs/tools-harness-ts/scripts/verify-specs.ts` / `… --strict-duplicates` | §9 | exit 0 (9 warnings) / exit 1 (9 pairs) |
| `cd libs/game-puzzle-client-ts && bun run lint` | working tree | exit 1: `use-puzzle-rating-events.ts` organizeImports |
| `git archive HEAD biome.json libs/tools-harness-ts/biome-plugins libs/game-puzzle-client-ts libs/game-puzzle-shared-ts \| tar -x -C /tmp/fhr/{clean,dirty}`; copy the three working-tree files into `dirty`; `biome check libs/game-puzzle-client-ts libs/game-puzzle-shared-ts` in each | lint attribution, without a git worktree (AGENTS.md forbids agents adding one) | clean: exit 0, 187 files; dirty: exit 1, 1 error |
| `TURBO_CONCURRENCY=3 bun verify [--continue=dependencies-successful]`, detached, `uptime` load 6–25 | full PR gate, 1198 tasks | see below |
| `VERIFY_TEST_CONCURRENCY=1 bun run test:spec:22`; `bun test --parallel=1 --no-isolate <file> <feed slice>` | bisecting the spec:22 failure | see the fixes below |
| `bun run verify:models:10`; `VERIFY_TEST_CONCURRENCY=1 bun run test:spec:20` in `libs/games-harness-ts` | re-timing the budget overruns | 10 s; 113 s (90/0) |

### The PR gate

`bun verify` ran with the secrets cache available offline (`secrets-run`)
and `TURBO_CONCURRENCY=3`. No gate was weakened:
- The local 600 s run deadline (`verify-budget.ts`) stayed as it is. A cold run of 1198 tasks at concurrency 3 cannot finish inside it, so the gate was re-run unchanged. Each run published its finished tasks to the turbo cache (`publishCheckArtifacts`), and the next run executed only what remained.
- From run 4 on, `--continue=dependencies-successful` let every task report past the known lint failure. The gate still exits non-zero on any failure.

| Runs | HEAD | Tasks successful | Failures | Cause |
| --- | --- | --- | --- | --- |
| 1–2 | `7455fc070` | 290, then 345 more | none (deadline) | — |
| 3 | `7455fc070` | 84 of 114 started | `@libs/permissions-harness-ts#test` (5 tests, ENOENT `specs/chess/daily-puzzle-limit.dmn`) | **This branch.** `73a546c62` moved the table, and the package's test task declared no spec inputs. Fixed in `720ce4b76`. |
| 4–7 | `720ce4b76` | 1080 → 1185 of 1198 | `@libs/game-puzzle-client-ts#lint`; `@libs/games-harness-ts#test:spec:22` | lint: **the other session's uncommitted files** (A/B above). spec:22: **this branch**, fixed in `7e70d865e` |
| 8 | `720ce4b76` | void | `No space left on device` | A shared disk filled up. I removed only my own run snapshots. |
| 9 | `720ce4b76` | 1196 of 1198 | the same two | as above; spec:22 also reproduced locally with `VERIFY_TEST_CONCURRENCY=1` |
| 10–14 | `7e70d865e` | **1197 of 1198** (run 14: 1189 cached + 8 executed) | `@libs/game-puzzle-client-ts#lint` only | the other session's uncommitted files |

**Gate outcome by task family at `7e70d865e`:**
- `lint`: everything passes except `@libs/game-puzzle-client-ts`, which fails only with the three uncommitted files present (HEAD's tree passes Biome).
- Every other task of the 1198 passes: `tc`, `test`, `test:spec:*`, `test:contract:*`, `verify:models*`, the `@libs/tools-harness-ts` gates, builds and bundles.

**Fixes made during validation**, each committed separately with a regression test:
1. **`720ce4b76`** `fix(permissions)`:
   - `decision-mutations.test.ts` reads `games/daily-puzzle-limit.dmn`.
   - `libs/permissions-harness-ts/turbo.json` declares `specs/conformance.yaml` and `specs/*/*.dmn` as its `test` inputs.
   - Regression `permissions-harness-spec-inputs-unhashed` (`tests/spec-inputs.test.ts`, red without the inputs).
   - Result: 17 pass / 0 fail (previously 11 / 5).
2. **`7e70d865e`** `fix(games)`:
   - The cause: the theme pool held two themed puzzles, so after a themed first pick and the limit, the skip exhausted the feed. The product correctly said "No puzzles left", and the scenario timed out.
   - The fix: `tests/steps/theme-pool.ts` makes every known puzzle themed and adds one more puzzle without the theme; `writeKnownPuzzlePool` accepts a game's more puzzles.
   - Regression `puzzle-theme-pool-exhausted-by-first-pick` (`tests/puzzle-theme-pool.test.ts`, red with the old pool).
   - Result: serial part 22 passes 33 / 0, and the failing file orders pass 13 / 0 and 20 / 0.

**Pre-existing on `main`.** No gate failure was traced to `main`. The two
fixed failures were caused by this branch's changes. The permissions
package's missing spec inputs predate the branch (no `turbo.json` on
`main`), but the branch's spec move is what exposed them.

**Not run:** `bun verify-nightly` (deeper property and trace budgets); the
Verify PR workflow on GitHub.
