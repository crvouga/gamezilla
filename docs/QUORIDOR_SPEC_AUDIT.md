# Quoridor specification audit

Verdict: **Changed scope passes; full-repository verification is incomplete.**
All 58 current Quoridor tests, the board-rule bindings and the normal wording
gate pass. Both modes passed the complete bounded proof, and the product
statechart passed. The strict audit retains thirteen existing near-duplicate
pairs outside the touched scope. The full local gate reached its fixed
deadline; CI reproduces an existing account-deletion recovery failure.
The completed live release attempt also has an unresolved gateway failure.

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
| Invariant | `invTurns` | Modes: selected mode; Movement: wrong-player refusal and fourth-player turn wrap | Covered |
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
- The current normal `ci:specs` gate passed in 7.09 seconds after the
  shared early-withdrawal bindings and scoped vocabulary repair.
- The complete product statechart check passed in 14.09 seconds.
- The full bounded proof passed both fixed mode cases and all eight
  invariants through two steps in **88.308 seconds**, within the unchanged
  combined 240-second deadline. Verified model blob
  `52b88f86ed1062d3bb71c3cf9a5ff96602dd12d5` is unchanged in code head
  `51aed800a`; the Turbo verification key is `3a2ff0573f2e8e67`.
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

The earlier full package command
`bun run spec --package @libs/quoridor-harness-ts` completed with 53 passing
tests. The final current-tree run executed all three official
`test:spec:0`, `test:spec:1` and `test:spec:2` Turbo tasks serially:
**58 passing tests, zero failures and 127 assertions**. It includes both
fixed mode cases, their scoped historical pins, real bot victories for both
goals, keyboard controls, all four pawn shapes, wall-path refusals and forced
pass. Package type checking and linting also passed.

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

An earlier two-part run timed out under concurrent model work. The final
official plan retains four drawn traces per mode, one action-cover trace
and one correctly scoped historical pin per mode. Its two-part load would
exceed the existing 30-unit cap, so the complete suite now has three parts
at 17.83, 18.33 and 18.83 units. No timeout, sample count or retry policy
was relaxed. The final whole-repository gate must execute those parts.

The current model and movement preflight passed **29 tests and 51
assertions in 55.17 seconds**. It checked both draws, every bound action,
both correctly labeled historical pins, all movement examples and the
canonical exhausted-player pass. Earlier preflights caught an unconstrained
mode field and private helper labels; the final model explicitly constrains
its mode and keeps its public action labels without decoder workarounds.

The model keeps the full 9×9 board, both goals, all 128 wall anchors and
the complete 81-round connectivity fallback. Its equivalent small-wall
formula is checked independently against full board connectivity for every
wall pair, every pawn square and all three goal kinds. Cached adjacency,
constant turn divisors and direct allowed/refused path predicates avoid
repeating equivalent symbolic work. Removing a duplicate pawn-sampling
branch preserves every labeled transition because the retained branch
already chooses every player and every board square. Both Boolean mode
assignments retain the full union of Classic and hill histories and both
initial situations. Public mode consistency and the per-player resource
bound strengthen the existing invariants; all eight targets remain.

The central-wall theorem has 75,467 independent assertions across every
zero-, one- and two-wall layout. A player cannot have exhausted five walls
while at most two are placed, and a central candidate preserves every
component, so an early hill pass must be refused. For three or more walls,
the original complete pawn, inventory and 128-wall checks remain. The
general connection map is constructed only inside that branch. These
equivalent computations made the full proof finish without reducing its
board, goals, histories, bound or deadline. Executable trace replay and
the exhaustive bounded proof are separate passing checks.

The product chart now links both mode choices into the existing custom,
matched and review lifecycle and owns every new Quoridor, journey and
four-player contract. Its first check found only four previously unowned
request-quality and missing-space contracts. Those references now attach
to the existing measured-request and space-recovery owners. The final
complete chart check passed with all these contracts owned.

## Final repository and release limits

`bun fmt` passed. The final `bun verify` on code head `51aed800a` acquired
the machine-wide slot and ran in its own snapshot. Generation passed all
seven tasks. Verification completed 110 tasks successfully, then reached
the unchanged 600-second deadline during
`@pkgs/matchmaking-root-harness-ts#verify:models:1` and exited **124**.
No task failure preceded that deadline. The unfinished Quoridor parts were
then executed serially and all passed, as recorded above. This is not a
green full gate; neither its deadline nor any test budget was raised.

Final review also pinned a four-person, zero-move game where a noncreator's
cancel command incorrectly succeeded. The existing cancellation contract
limits that noncreator path to two people. The public command regression
failed first, then passed with the shared predicate corrected; the same
predicate controls the rendered affordance. Creator cancellation,
two-person cancellation and four-person resignation remain covered. The
affected package's 40 tests and both shared/client type checks and lint
passed. The registry entry is `four-seat-noncreator-cancel`.

The latest [PR verification on code head 51aed800a](https://github.com/crvouga/gamezilla/actions/runs/39974256820)
has reproduced the deleted-account puzzle-statistics failure:
the other device still reads
`{"label":null,"played":null,"empty":false}` after 30 seconds of virtual
time. The exact scenario and value also failed on
[main f6cd59198](https://github.com/crvouga/gamezilla/actions/runs/39944125420/job/120390082092).
The other PR shards were still running when this evidence was recorded.
The earlier main run also failed the independent Chess geometry property
and synthetic-population runtime tests; those are not claimed as passing.

The completed [live release attempt](https://github.com/crvouga/gamezilla/actions/runs/39967949971/job/120466042594)
recognized all new step bindings, but both new journeys and both health
checks stopped at shared synthetic-monitor sign-in, before a game action:
`POST /auth/synthetic-monitor/code` returned an empty HTTP 502. The unchanged
load balancer returns that response when its upstream request throws.
Main had the same two legacy Chess journey failures and database-pool
refusals, but the exact 502 was not observed there. Shared capacity is only
a possible explanation; the 502's cause remains unresolved. The focused
in-process Classic and four-person hill journeys both passed. No deployed
availability or clean live release is claimed.

The dispatched [nightly random run](https://github.com/crvouga/gamezilla/actions/runs/39968140362)
had not completed. An earlier attempt failed four Battleship properties at
the existing five-second limit; [main's nightly run](https://github.com/crvouga/gamezilla/actions/runs/39962505694)
had those same four failures. Read-only preview planning was also blocked
by a Railway project authorization denial; no infrastructure apply occurred.

The PR remains a draft. CI and person-facing release-readiness attestations
remain unchecked. The thirteen strict duplicate findings, full-gate timeout
and live sign-in failure prevent a clean full-tree or release verdict.
