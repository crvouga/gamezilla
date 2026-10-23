# Quoridor specification audit

The rules source is [Gigamic's published rulebook](https://export.gigamic.com/wp-content/uploads/2021/01/INS-RULES-QUORIDOR_10-2016.pdf).
The two-player rules are canonical. Four-Player King of the Hill is the
explicit house variant in the Quoridor glossary: four clockwise players,
five walls each, and immediate victory on first reaching e5. The published
four-player game instead races to the opposite edge. Its board, walls and
one-pawn jumping rules supply the common mechanics used here.

The supplied goal prompt explicitly authorizes choosing a coherent variant
and documenting assumptions without another approval stage. That authority
covers the new Quoridor vocabulary and the generic four-player vocabulary.

## Authoring checks

The features use cast names, one event per scenario, observable outcomes,
and refusals with reasons. All scenarios sit under rules. No scenario has
more than five steps. Positive and negative examples cover every rule
unless its first description states why there is no counter-example.
The new language passed the vocabulary and wording checks in
`bun run spec:verify` on 2026-10-23. The new domain's undefined steps and
unbound model are the implementation handoff, with the new harness still
being built.

| Feature | A0–A6, B1–B17 review | Coverage |
| --- | --- | --- |
| `quoridor-modes.feature` | Product terms; two concrete mode examples; shared readiness owns incomplete lineups | Both declared starts, inventories, goal descriptions and turn order |
| `quoridor-movement.feature` | Concrete board situations and moves; each refusal identifies its reason | Steps, backward movement, straight jumps, wall/edge/occupied landing diagonals, no chained jump, occupancy, ownership and four-player turn wrap |
| `quoridor-walls.feature` | Observable wall boundaries and inventories; no stored or transport details | Both orientations, boundary, adjacency, overlap, crossing, every player's path and exhausted inventory |
| `quoridor-objectives.feature` | Explicit immediate outcomes; no hold or simultaneous result ambiguity | Both goals, wrong goal, finality after both modes |
| `games/multi-seat-games.feature` | Shared game language; no named concrete game | Full lineup, all-person readiness, disconnect without skipped turn, unanimous draw, withdrawal and timeout |
| `games/four-seat-matchmaking.feature` | Shared game and clock choices; no game-specific matching path | Full compatible group, incompatible clock, unanimous rematch and rotated sides |

## Quoridor model coverage

The local model describes the rules of the board independently of the
shared game's connection and lifecycle rules. Shared game specifications
remain responsible for persistence, reconnect, stale choices, duplicate
choices, permission decisions, cancellation and rematches.

| Kind | Model name | Illustrating feature | Result |
| --- | --- | --- | --- |
| Command | `movePawn` | Movement: forward step and clear jump | Covered |
| Command | `placeWall` | Walls: horizontal and vertical placement | Covered |
| Invariant | `invPawns` | Movement: occupied square refusal | Covered |
| Invariant | `invWalls` | Walls: boundary, overlap and crossing refusals | Covered |
| Invariant | `invPaths` | Walls: closing North, South or East's final path | Covered |
| Invariant | `invInventory` | Walls: last wall permitted, exhausted inventory refused | Covered |
| Invariant | `invTurns` | Movement: wrong-player refusal and fourth-player turn wrap | Covered |
| Invariant | `invVictory` | Objectives: reaching correct goal versus reaching wrong goal | Covered |
| Invariant | `invRefusal` | Movement and walls: board, inventory and turn unchanged | Covered |
| Invariant | `invFinality` | Objectives: moves and wall placement refused after victory | Covered |
| Transition | No winner → South victory | Objectives: both mode victory examples | Covered |
| Illegal | Pawn move or wall placement after victory | Objectives: both post-victory refusals | Covered |
| Status | Classic / hill | Modes: both starts | Covered |
| Event / policy | No domain events or downstream event reactions | Shared game specifications own lifecycle | Not applicable |

Serialization, exact opaque spellings, replay, malformed input, duplicate
requests and stale revisions belong to the shared contracts and code tests,
not new product-language scenarios. Bots use the same board actions;
their legal-action conformance belongs to the shared bot contract.

## Verification evidence and verdict

- `pkgs/quint-server-ts/node_modules/.bin/quint typecheck specs/quoridor/quoridor-play.qnt` passed.
- A Rust Quint run with all eight invariants, one sample, three steps and
  seed 12345 passed in 2.5 seconds. This is a smoke check; the normal model
  campaign remains required during implementation.
- `bun run spec:verify` reached the new domain's undefined steps and
  unbound model. Remaining scaffolding findings name the new harness's
  `specParts` script and missing step/model indexes and model task inputs.
- `bunx turbo run ci:specs --filter=@libs/tools-harness-ts -- --strict-duplicates`
  ran the strict check. It also reports pre-existing near-duplicate step
  wording between Chess, Battleship, Runtime and the shared Games harness.

Verdict: **INCOMPLETE** until the implementation supplies the bindings and
the full gate clears. The strict duplicate findings outside this change
are evidence of the current gate result, not a claim that the new specs
have passed a clean full-tree audit. No implementation steps existed in
the new domain at this authoring handoff, so D2–D6 await implementation.
