# Quoridor specification audit

Verdict: **INCOMPLETE**. The board-rule bindings, focused execution checks
and normal wording gate pass. The strict audit reports thirteen existing
near-duplicate pairs outside the touched scope. The current bounded proof,
statechart check and final whole-repository gate remain pending.

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
`bun run spec:verify` on 2026-10-23. Every Quoridor board-rule step and model
action now has a binding. The final review corrected the exhausted-wall
rule to forbid another wall, rather than require a pawn move when the hill
rules require a forced pass. The late shared four-player examples for
account deletion and missing the first move now pass through their actual
workflow. Their literal unit/property failures preceded the product fix;
the new feature bindings' first invocation was green. No earlier
feature-level red is claimed. The goal explicitly permits specifications
before or alongside implementation.

| Feature | A0–A6, B1–B17 review | Coverage |
| --- | --- | --- |
| `quoridor-modes.feature` | Product terms; two concrete mode examples; shared readiness owns incomplete lineups | Both declared starts, inventories, goal descriptions and turn order |
| `quoridor-movement.feature` | Concrete board situations and moves; each refusal identifies its reason | Steps, backward movement, straight jumps, wall/edge/occupied landing diagonals, no chained jump, occupancy, ownership and four-player turn wrap |
| `quoridor-walls.feature` | Observable wall boundaries and inventories; no stored or transport details | Both orientations, boundary, adjacency, overlap, crossing, every player's path and exhausted inventory |
| `quoridor-objectives.feature` | Explicit immediate outcomes; no hold or simultaneous result ambiguity | Both goals, wrong goal, finality after both modes |
| `quoridor-accessibility.feature` | Observable board choices and identities; no gesture changes the rules | Keyboard pawn and wall actions, four distinct shapes, crossing preview, read-only watcher |
| `quoridor-bots.feature` | A scheduled bot follows the same pawn rules | Both mode goals reached by a real custom-game bot |
| `quoridor-health.feature` | Standing checks through the established live runner | Two-person Classic and two-person/two-bot King of the Hill |
| `journeys/quoridor-game.feature` | Fresh-device journeys use published mode and bot terms | Completed, agreed results in both modes |
| `games/multi-seat-games.feature` | Shared game language; no named concrete game | Full lineup, all-person readiness, disconnect without skipped turn, unanimous draw, withdrawal and timeout |
| `games/four-seat-matchmaking.feature` | Shared game and clock choices; no game-specific matching path | Full compatible group, incompatible clock, unanimous rematch, rotated sides, and withdrawal or missed first move before play |
| `games/multi-seat-recovery.feature` | A returning person sees the board, turns and result | Third-player reconnect, legal replies from three bots offline, and the finished offline result kept on return |

## Quoridor model coverage

The local model describes the rules of the board independently of the
shared game's connection and lifecycle rules. Shared game specifications
remain responsible for persistence, reconnect, stale choices, duplicate
choices, permission decisions, cancellation and rematches.

| Kind | Model name | Illustrating feature | Result |
| --- | --- | --- | --- |
| Command | `movePawn` | Movement: forward step and clear jump | Covered |
| Command | `placeWall` | Walls: horizontal and vertical placement | Covered |
| Command | `passTurn` | Movement: exhausted blocked corridor versus voluntary pass refusal | Covered |
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
- The current normal `ci:specs` gate passed in 10.02 seconds after the
  shared early-withdrawal bindings and scoped vocabulary repair.
- `bunx turbo run ci:specs --filter=@libs/tools-harness-ts -- --strict-duplicates`
  ran the current strict check. It failed only on thirteen existing
  near-duplicate pairs between Chess, Battleship, Friends, Runtime and the
  shared Games harness. None names a Quoridor or new four-player step.

These strict duplicate findings do not establish a clean full-tree pass.
D2–D6 review finds one package registration, thin steps
over exported harness actions and reads, and model bindings using the
model's actual action names and public variables. Selectors and board
gestures remain in exported harness actions, not step definitions.

The newly published bare words “start” and “ready” initially claimed
ordinary English in unrelated contexts, which caused CI wording failures.
They now publish only scoped custom-game phrases; Quoridor borrows those
phrases. The definitions and model mappings retain their meaning, and the
normal wording gate confirms that unrelated contexts need no new borrows.

## Implementation verification

The Quoridor harness now binds every board-rule scenario and the model to
the canonical custom-game framework. Given positions are accepted action
histories, including the 32-action exhausted corridor; no arbitrary board
or fabricated winner is installed. Legal pawn and wall actions use the
rendered controls. Refused modified-device pawn choices use the shared
acknowledged command path, while wall previews expose the board's actual
reason. The shared adapters enroll both modes in the existing conformance
registry and read all participants from their exported game records.

The full package command `bun run spec --package @libs/quoridor-harness-ts`
completed with **53 passing tests, zero failures and 127 assertions**. That
run included the pinned model trace, real bot victories for both goals,
keyboard controls, all four pawn shapes, wall-path refusals and forced pass.
Package type checking and linting also passed. Later wording and equivalent
model-expression changes require a current-tree final rerun.

After the mode-start wording changed, the scenarios first failed on the
new undefined Given. Their completed bindings then passed both examples,
with nine assertions. The Given establishes ready players; the When uses
only the actual start control. Harness type checking and linting passed
again. The two affected existing runtime and Connect Four test packages
also passed after their literal schema/projection fixtures were completed;
their exact inventory and winning-cell assertions remain intact.

The four-player matching feature passed all six examples with 30 assertions,
including account deletion and missing the first move before anyone has
played. Earlier literal failures returned an aborted game instead of a
draw; the clock property also pinned `[0, '3+2', 0]` at seed 424242. These
are the actual red-first regression evidence, separate from the later
green business illustrations.

The declared two-part Turbo run reached a **240-second timeout**, with no
assertion mismatch, in the 32-action opposite-row hill setup while both
parts and model checking ran together. That same example passed in the full
package run. No timeout or retry policy was changed. An isolated final gate
remains required.

The model keeps the full 9×9 board, both goals, all 128 wall anchors and
the complete 81-round connectivity fallback. Its equivalent small-wall
formula is checked independently against full board connectivity for every
wall pair, every pawn square and all three goal kinds. Cached adjacency,
constant turn divisors and direct allowed/refused path predicates avoid
repeating equivalent symbolic work. Removing a duplicate pawn-sampling
branch preserves every labeled transition because the retained branch
already chooses every player and every board square. All eight invariants,
the two-step bounded proof and its four-minute deadline remain unchanged.

The latest completed proof passed the first successor state's accepted and
refused pawn and wall cases, then timed out compiling the remaining pass
refusal. Direct refusal predicates avoided the earlier full-flood expansion.
The wall boundary comparisons now use equivalent scalar equalities for
arbitrary integer endpoints instead of constructing two-element sets.
The updated model typechecks, and its full bounded proof is pending.
Successful executable trace replay is separate evidence from this proof.

The product chart now links both mode choices into the existing custom,
matched and review lifecycle and owns every new Quoridor, journey and
four-player contract. Its first check found only four previously unowned
request-quality and missing-space contracts. Those references now attach
to the existing measured-request and space-recovery owners; a fresh
statechart check remains required.

The final whole-repository strict gate and readiness verdict remain the
completion audit. This report remains **INCOMPLETE** until those exact
current-tree checks and the outstanding model proof succeed.
