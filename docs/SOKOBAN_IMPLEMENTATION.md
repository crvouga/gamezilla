# Sokoban implementation

Scope: the request in [`SOKOBAN_GOAL.md`](SOKOBAN_GOAL.md) — Sokoban as the
second structurally different consumer of the shared puzzle framework, and the
framework refinements it exposed. Product contracts live in
[Sokoban](../specs/sokoban/), [Puzzles](../specs/puzzles/) and
[journeys](../specs/journeys/sokoban-packs.feature); spec decisions are in
[`SOKOBAN_SPEC_AUDIT.md`](SOKOBAN_SPEC_AUDIT.md). This ledger records delivery
and evidence; it is not a second product definition.

## Ownership

| Owner | Package | Holds |
| --- | --- | --- |
| Shared contract | `@pkgs/turn-game-shared-ts/puzzle-content` | `PuzzleContent`: rules, `rulesVersion`, replayed `PuzzleEvidence`, bundled packs |
| Shared domain | `@libs/game-puzzle-shared-ts` | drafts, editions, packs, attempts, evidence replay, edition rules, bundled editions, draft edit history, pack progress |
| Shared screens | `@libs/game-puzzle-client-ts` | builder (undo/redo, proof status), player shell (rules-changed stop), library (starter packs) |
| Shared harness | `@libs/game-puzzle-harness-ts` | `createContentWorld` for any game, builder session, game-facing reads, journey helpers |
| Design system | `@pkgs/ui-root-client-ts/tile-board` | a steerable tile board (keys, swipes, taps, reduced motion) |
| Sokoban | `@libs/sokoban-shared-ts`, `-client-ts`, `-harness-ts` | rules, codecs, board edits, bounded solver, starter pack; player, editor, preview; specs, models, contracts |

Sokoban imports no Numberlink code, and shared code names no game.

## Shared contracts changed and consumers migrated

- Publication evidence was a client-supplied final state. It is now a
  referenced playtest attempt whose accepted actions the authority replays
  against exactly the published definition under the current rules; a game's
  `validatePublication(definition, evidence)` sees only replayed evidence.
  Kept evidence is an action record, replayed on every use and carried across
  details-only edits. Numberlink, the counting reference app and contract
  fixtures migrated. Regression: `puzzle-evidence-claimed-final-state`.
- `rulesVersion` is required. Editions and attempts pin it; a mismatch refuses
  starting or continuing, keeps the attempt and says why. Existing rows read
  as version 1 through schema backfill.
- Attempt histories keep states only at keyframes and the cursor (old
  full-state histories stay readable): 2,000 moves save 35 KB instead of a
  state per move per position.
- Bundled packs ship with a game and appear offline in every library.
- The shared builder undoes and redoes draft edits for every game, binding the
  previously unbound `edit-draft-history.feature` and `draft-editing.qnt`.
- Pack progress follows the shared offer policy (regression
  `pack-offer-skips-last-played-completed-puzzle`).
- The harness world, app factory, convergence check and journey library
  navigation take a game instead of naming the counting app or Numberlink.
- Pre-existing defects fixed separately: a puzzle-only game's menu threw
  (`puzzle-only-menu-reads-turn-rules`); a broken permissions import and a
  journey host type error from the Quoridor merge.

## Evidence (this branch, Apple M2 Max, Bun 1.4.3)

- Sokoban: 82 scenarios and 4 models (`sokoban-play`, `board-building`,
  `publication-proof`, `starter-pack`) — 105 checks pass through the real
  shared screens, mutations and sync engine.
- Puzzles: 170 checks pass, including the newly bound draft history and
  edition rules features and models.
- Journeys: the three Sokoban and four Numberlink journeys pass in process.
- Rules package: 39 tests (property tests of moves, pushes, completion,
  codecs, board edits, witnesses and solver agreement with exhaustive search).
- Shared tests: evidence replay and forgery, history compaction (mutation
  checked), draft edit history, bundled editions, pack offers; input
  contracts for the Sokoban player and editor; `TileBoard` component tests.
- `bun run spec:verify` and `ci:i18n` pass.
- Limits: a 20 × 20 board; witnesses and histories of at most 10,000
  actions. Replaying a maximal witness on a 20 × 20 board takes about
  300 ms; one move appends in about 0.07 ms; one undo in about 0.9 ms.
  Publication validation runs no search.

## Remaining limitations

- `ci:goals` fails on a pre-existing Pong known-bug whose regression test file
  does not exist (`pong-recovered-court-pause-not-observed`).
- Publishing again after a rules change with no edit since keeps the earlier
  edition (the shared "same saved draft" rule); an edit is needed first. This
  is recorded as an open product question in the spec audit.
- Moves pressed while one is being saved are queued (at most four); key
  repeat beyond that is dropped.
- The starter pack is bundled, so it needs no production seeding; changing a
  shipped puzzle creates a new edition and earlier attempts stay kept.
- Automated UI-quality verification, real-browser stack runs and the full
  release gate are recorded by their own runs, not by this ledger.
