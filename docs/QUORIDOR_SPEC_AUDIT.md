# Quoridor specification audit

Verdict: **Implementation, focused checks and all model proofs pass; full local verification remains incomplete.**
All 58 PR-profile Quoridor tests and both full bounded mode proofs have passed.
The tests comprise 47 feature scenarios, seven model checks and four model replays.
The enforced dependency audit and unchanged strict export tests pass with
Atlas 0.10.2, which includes the upstream fixes for
[issue 16](https://github.com/crvouga/atlas/issues/16) and
[issue 18](https://github.com/crvouga/atlas/issues/18).
The full local gate and release journeys are being rerun after a confirmed
local-stack interruption; the replacement run is currently queued.
CI remains unverified because GitHub refused to start its jobs under the
Actions budget.
The current full CI and live journey verdicts belong to PR 226.
This report does not claim deployed availability or a green release gate.

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
- The fresh CI Quoridor proof (run 40075632359, job 120819634751)
  completed both fixed mode cases and all eight invariants through two steps
  in **155.1 seconds**, within the unchanged combined 240-second deadline.
  Its successful cache artifact was written before the overall run was
  cancelled by the next push. Model blob
  `52b88f86ed1062d3bb71c3cf9a5ff96602dd12d5` is unchanged. This is a passing
  model task, not a passing full workflow.
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

Both modes use the existing custom-game and matched-game frameworks.
Their shared contracts cover registration, readiness, ownership, stale and
duplicate choices, permissions, persistence, replay, recovery, clocks,
ratings, records and rematches. Registry enrollment checks both modes;
generic framework code contains no Quoridor-specific branches.

The board-rule bindings establish positions through accepted histories,
including the 32-action exhausted corridor. Legal choices use rendered
controls. Modified-device refusals use the acknowledged command path, and
wall previews expose the actual refusal reason. No arbitrary board or
fabricated winner is installed.

| Automated check | Recorded result |
| --- | --- |
| Official Quoridor `test:spec:0`, `:1`, `:2` | All three parts pass; 47 feature scenarios, seven model checks and four model replays |
| Nightly Quoridor profile, all three parts | 64 tests, 127 assertions, no failures or skips; all ten model replays executed |
| Nightly focused properties | Five affected packages, 155 tests and 143,859 assertions pass at the official 200-run budget |
| Final permission and matching nightly checks | 152 tests, 14,049 assertions pass at 200 runs per property; fresh seed 1057416651 |
| Quoridor bounded proof | Both modes, eight invariants, two steps; fresh CI task passes in 155.1s and the latest fresh local proof in 172.6s |
| Full framework-independence contract | Eight outer checks, 105 assertions; main process runs 281 checks; independent consumer features pass |
| Runtime harness package | 59 tests, 257 assertions after integration with main; type checking and lint pass, including reviewed-board recovery and bounded failure context |
| Runtime scenario part 13 | All 14 cases in six files pass in 4.84s after the upgrade-refusal fix |
| Sync HTTP client | 27 tests, 757 assertions, including two public HTTP properties; type checking and lint pass |
| Harness preparation package | 106 tests, 786 assertions; type checking and lint pass |
| Room checkpoint package | 22 tests, 29 assertions; type checking and lint pass |
| Deleted-account recovery | All 15 affected scenarios pass through actual device recovery |
| Payment evidence and retention | Original billing part 20 and affected harness/shared/server checks pass |

The independent final implementation review found no high- or
medium-severity issue in domain edge cases, UI accessibility, bots,
registrations, the four-person lifecycle or shared authority/recovery
contracts. It found no skipped Quoridor checks, temporary workarounds or
relaxed limits. The strict wording audit still reports the thirteen older
near-duplicate pairs documented above; its current run adds none in this
scope.

## Proof and performance guarantees

The model retains the full 9×9 board, both goals, all 128 wall anchors and
the complete 81-round connectivity fallback. The equivalent small-wall
formula is independently checked against full connectivity for every wall
pair, pawn square and goal kind. The central-wall witness has 75,467
independent assertions across zero-, one- and two-wall layouts. General
connectivity and forced-pass checks remain for larger layouts.

Both Boolean assignments, all eight invariant targets and both initial
situations remain. Preparation keeps four drawn traces per mode. The PR
profile executes the minimum action-cover selection plus each historical
pin: four replays total across both modes. The nightly profile executes
all four drawn traces and the historical pin per mode: ten replays total.
Its three parts stay within the existing 30-unit cap. No proof depth,
deadline, trace count, assertion or retry policy was relaxed.

One latest local proof reached the 240-second deadline on the hill case.
A compiler-input comparison established byte-identical instantiated and
cached inputs before and after the preparation optimization, for both
modes. The subsequent fresh CI proof passed as recorded above. The local
timeout itself remains an unsuccessful check.

## Regressions resolved during integration

The change pins literal failures for multi-seat clocks, consent,
withdrawal, cancellation, roster projections and announcements. It also
pins the blocked-pawn bot, exhausted-wall pass, invalid/accepted wall
preview and terminal-turn cases. Each has its own known-bug entry and
example test; model and shared-contract coverage remain active.

The later verification failures exposed additional shared defects:

- Postgres idle errors could terminate the API process. The guarded client
  now routes them through request failure and cleanup; actual Postgres
  contracts and an independent command-model property pass.
- A foreground mutation drained unrelated outbox work. Actor-bound
  causation now drains only its committed chain, preserving descendants,
  duplicate acknowledgments, rollback and the global recovery drain.
- Warm database seeds omitted framework schema changes. Migration and
  fingerprinting now share the complete schema registry.
- Independent privacy bootstraps produced different pre-secret presence
  histories. Both counterfactual branches now begin at one exact checkpoint
  and still compare the complete externally visible wire.
- Initial room hydration could overwrite a restored checkpoint. Replacement
  now awaits that initial load; the literal membership/presence race passes.
- The hill journey read an older host turn after the guest and both bots
  moved. Every new board read now waits for the last accepted move.
- Protocol upgrade refusals incorrectly refreshed authentication and could
  spin indefinitely. They now surface the update request immediately;
  expired-session and malformed-response recovery remain covered.

The fresh live runs on heads `101e4df7b` and `83776eb9e` passed the
Quoridor cases but still failed the older Chess five-second pairing case.
The latter run also exposed an avoidable cold-plan capacity problem:
49 separate proof lanes left fifteen lanes with 1,261–1,262 estimated
seconds each, already beyond the fixed 1,200-second shard deadline.
The corrected planner preserves every task, dependency group and stage
across the same 64 runners. Replaying that captured plan reduces its
heaviest estimated lane to 360 seconds. All 870 tooling tests, type checks,
lint and goal checks pass; no budget or concurrency changed.

The database wire proxy also left Nagle buffering enabled on both TCP
legs, in addition to its declared round-trip model. Both legs now request
`TCP_NODELAY`; the configured three-millisecond delay, pool and request
counts are unchanged. All five real-wire contracts and their 72-test
owning unit shard pass. The existing exact 5+0, five-second journey is
pinned without changing its prose or deadline. CI run 40081895815 still
failed that deadline, so this configuration correction is not claimed as
its resolution. That run passed every other task except dependency audit;
the corrected shard distribution incurred no shard deadline failures.

Matchmaking notification lookups are now batched per captured table,
retaining every old and new owner image. The actual Find regression drops
from five lookups to at most three while preserving delivery to both
players and both hosted-space observers. This measured saving alone did
not resolve the Chess deadline and is not presented as its cause.

The failed request's collected server spans show 6.22 seconds overall,
including 3.86 seconds in match formation. Formation now reads the roster
and rating snapshots together and writes player and availability changes
in batches. The actual Find regression drops from 35 statements to 27,
retaining delivery to both players and both hosted-space observers. All
six eligible games pass the complete authority contract (24 tests, 434
assertions); owning properties, history/rating checks and downstream static
checks pass. An independent review found no authority or capture regression.
CI run 40085206806 still failed the five-second Chess pairing case after
this reduction. Its selected request took 5.83 seconds, including 3.17
seconds in formation. The complete run failed only release journeys and
dependency audit; all other verification tasks passed. These two observed
requests are not a controlled benchmark or proof of a resolved deadline.

The local Find mutation body also repeated permission facts and its search-state
read. An explicit permission snapshot now serves the consecutive pre-write
grant checks through the same evaluator and refusal formatter as ordinary
checks. It retains no database reader. The unfinished limit still reads fresh
facts after the owner lock; the authoritative waiting-state reread remains.
The literal local body drops from twelve SQL statements to seven, preserving
five first-refusal cases and a competing-Find refusal under the lock. Both
owning packages pass type checking, lint and all 152 tests. The fresh nightly
run above exercises the new snapshot properties with the official budget.

Additional matching checks at fresh seed 2076662651 passed 2,000 generated
cases across ten properties, including all six games' record laws, plus the
26 generic SQL matching contracts. This run found a fixture that accumulated
old history across generated examples. Independent examples now roll back,
and a pinned nonempty-then-empty sequence confirms that no history remains.
At the identical seed and 200 cases, its property dropped from 29.3 seconds
to 394 milliseconds under the unchanged five-second limit.

Failure-only release diagnostics now use the existing canonical scenario
reporter and native collector journal. Their timestamps select the failed
scenario's request traces, retain later completed children, and exclude
later successful matches. Output is bounded and redacted; absent roots
are explicitly incomplete. Temporary PR reports are still removed. All
264 product unit tests (2,019 assertions), type checks and lint pass. No extra runtime logs,
artifact retention, waits or test budgets were introduced.
Repeated request resource and identity attributes are emitted once, while
changed child context remains visible. A literal regression confirms that
the bounded summary retains terminal database work instead of truncating
it behind repeated context; the owning unit, type and lint tasks pass.
Client upload and originating interaction excerpts now follow the selected
mutation's exact recorded identifiers and links in the same native journal.
Missing exports are stated explicitly, with no inferred phase duration.
The index reuses already-normalized records, and all client excerpts share
a 2,000-character cap for the complete run. Controlled examples verify
event-only and link-only matches, later unrelated actions, selected-detail
timestamps, redaction and the cap without recovering or inventing CI spans.

CI run 40088244003 still missed the Chess pairing deadline. Its selected
Find spent 2.31 seconds between mutation minting and client upload start,
161 milliseconds between upload start and server entry, and 3.55 seconds
in the server request. The acknowledgment arrived 1.10 seconds after the
failed observation ended. No mutation-origin link was recorded, so the
pre-upload interval cannot be split into remaining local work, queue or
availability waiting. These are recorded phase boundaries, not a claim
that one optimization resolved the deadline. The full release task took
441.267 seconds within its unchanged 600-second budget.

The full release-journey task in the current PR remains the authoritative
result. None of these focused successes establishes a green full release.

The foreground outbox loop now replaces a terminal empty transaction with
a fresh scoped due-work read. It covers both pending registered deliveries
and due events not yet routed, including retries, deleted or missing events
and registration changes. Any captured event write conservatively retains
the original next pass, including a write rolled back to a savepoint. The
pass limit, room delivery and acknowledgment ordering are retained. The
integrated loop publishes each committed pass before following descendants.
The HTTP root-to-child regression changes three
materialize/claim passes to two passes and one read with all prior outcomes
still asserted. The official 200-run property (seed 466084113), full outbox
contracts, actual PostgreSQL contract, type checks, lint and goal checks
pass. The complete wire-privacy contract passes all eight outer checks,
105 assertions and 281 main checks. A fresh live run must establish the
effect on the five-second pairing deadline.

The final applied mutation now leaves its savepoint for the enclosing
transaction's commit, removing one successful release statement. Earlier,
duplicate and rejected records still release normally; failures retain
rollback and release. Actual HTTP, PostgreSQL and SQLite contracts cover
acknowledgment, publication, mixed batches, late failures and subsequent
transaction reuse. The official 200-run checks (seed 1130279081) pass:
44 sync harness tests with 2,530 assertions and 20 server tests with 53
assertions, plus type checking, lint and goal checks. This saves one SQL
round trip; it does not establish a resolved pairing deadline.

CI run 40095444082
failed only the older Atlas export task and the release journeys. That
release task took 401.372 seconds and failed five scenarios: Chess pairing,
custom-game readiness, Battleship's own-fleet observation, and both hill
journeys. The selected Chess acknowledgment arrived 201 milliseconds after
the failed observation. Its originating interaction was absent from the
retained journal, so the pre-upload interval remains unattributed.

The hill helper previously chose from a parked observer before activating
the person whose turn it was. A literal 16-move accepted history reproduces
the disabled-f5 choice after a bot rebase. An actual-app regression also
reproduces a reviewed position paired with the live turn and move count.
The helper now activates that person, reads their board, returns to live
when necessary, and chooses only when that device can move. All eight
focused helper checks, both actual mode journeys and the actual reviewed-
board regression pass; the existing move deadlines and 400-turn bound
remain. The exact failed CI interleaving was not retained, so a fresh live
run must establish the result. Failure-only errors now retain bounded
public board counts, refusal context and failed control identifiers,
without fleet positions or gesture arguments. The other two new live
failures have no proven functional fix yet.

## Repository and upstream limits

The full `bun verify` on code head `24b21be39` exited 1 at
`@libs/tools-harness-ts#ci:audit` (36.8 seconds in the task runner), before
the upstream Atlas upgrade was installed. Patched Happy DOM/registrator 21.0.4, Undici 7.30.1 and
serialize-javascript 7.1.3 are installed; their focused checks pass.

The installed Atlas 0.1.0 used Zod 3.25.76, and a latest-only Atlas 0.10.0
installation reproduced the advisory. Upstream published 0.10.1 with Zod
4.6.7 and Vite 7.3.7 and closed [issue 16](https://github.com/crvouga/atlas/issues/16).
The isolated catalog/lockfile upgrade is commit `6c3925cd5`; it removes the
obsolete Atlas Vite override. The fresh enforced audit passes, and all seven
consumer test, type and statechart tasks pass. All 43 imported paths and
existing CLI commands remain available.

After acquiring the shared machine slot, the full local gate failed only
`@pkgs/atlas-reports-harness-ts#test` (362.2 seconds in the runner). Its
102 tests have 101 passes and one failure: static export returns two
addresses for one logical recording instead of one. Atlas 0.10.1 normalizes
archived records into schema key order while legacy records retain insertion
order; execution identity uses order-sensitive JSON serialization. Existing
[Atlas issue 18](https://github.com/crvouga/atlas/issues/18) covers the exact
publication/export failure and a reduced public-API example. The strict
one-recording, revision, timeline and snapshot assertions remain unchanged.
Upstream then published 0.10.2 and closed issue 18. The isolated upgrade is
commit `4ef4f9bfc`. All twelve consumer type, lint and test tasks pass,
including the unchanged strict export suite; the enforced dependency audit
also passes. No dependency patch, ignored advisory or relaxed gate is used.

CI run 40089692721 also found three old JUnit fixture objects missing
Atlas's now-required `classname`, `suite` and `time` fields. Commit
`7d323038e` supplies explicit null metadata; all existing assertions stay.
The owning package's type checking, lint and both focused tests pass.

Earlier full local attempts reached their fixed 600-second deadline during
existing matchmaking proofs. Their partial successes are not green full
verification. A complete nightly random run (40078618306, seed 1236218278)
processed all 169 discovered files and reproduced four Battleship
five-second property failures also present on main. The focused nightly
runs above pass; the whole random group did not. Nightly is not the release
gate. Read-only infrastructure rehearsal previously stopped at a
Railway project authorization denial; no infrastructure apply occurred.

The PR remains a draft while required verification is incomplete. CI and
person-facing readiness claims stay unchecked until supported by the
current full and live results. No deployed availability is claimed.

The local full gate on `749044829` exited 124 at its unchanged 600-second
run deadline (645.4 seconds including planning and cleanup). It completed
37 tasks; profile model part 1 had run for only eight seconds when stopped.
The Quoridor proof completed uncached with exit zero in 173.2 seconds
(172.6 seconds in the model runner). This is not a failed individual proof;
no complete local pass is claimed.

Integration with current main includes the independently verified fixes from
PR 225, including per-pass
delivery notifications, fenced row images, ordered push application and
further matching improvements. Integration retains the arbitrary-seat
contracts, durable causal recovery, scoped due-work witness and final
savepoint optimization. Fresh checks of the combined change determine its
verdict; the upstream green gate does not substitute for them.

Integration also pins two literal failures: a consumer's rolled-back row
was still included in a push, and an explicitly empty event scope registered
other deliveries. Only successful handler captures now supply published
images and child scopes; attempted writes still retain the conservative
next-pass check. Empty scopes return without registering or claiming work.
The 20 affected package tasks pass, covering 288 tests and 3,467 assertions.
The exact authority contract passes all 24 cases across six games; the
complete wire-privacy contract passes all eight outer checks and 281 main
checks. Fresh 200-run matching properties pass at seed 1271971665.
The four affected recovery suites also pass at the official 200-run depth
with fresh seed 998553586: 138 tests and 11,494 assertions. The actual Turbo
environment was checked for each suite. Goals and the enforced audit pass.
The complete tooling suite passes 871 tests; its unchanged five-second
graph check took 481 milliseconds in the isolated run. All twelve Quoridor
package tasks pass, including the 58 PR-profile spec checks.

CI run 40103814439
completed 22 verification shards successfully. One executed shard exposed
five hosted-space reads where the existing Find contract permits at most
three. The per-pass row-image path had bypassed the batched resolver.
Batch resolution now returns destinations for each input row, preserving
repeated ids, earlier and later owners, publication vetoes and fresh room
ownership. The original four-board and three-read assertions pass; the full
games suite passes 192 tests and 9,352 assertions. Both shared packages'
200-run properties pass at fresh seed 375035574, and the full framework
privacy contract passes unchanged.

The other 42 failed jobs never received a runner, including the release
journey job and final gate. GitHub's annotation is: "The job was not started
because an Actions budget is preventing further use." They produced no
test results. A funded CI run is still required; no spending limit, runner
policy, verification assertion or deadline was changed.

After the fanout fix, `bun verify` with two local Turbo workers exited 1
after 287.4 seconds: the existing custom-game play model did not complete
its liveness check within 240 seconds. It reached all 811,080 distinct
states with an empty exploration queue, then timed out checking the two
temporal properties. A single-task serial invocation also timed out, with
the same task hash `1dcee8efadaedd8b` and no counterexample. All twelve
safety invariants and both liveness properties remain requested. The model
bytes match main and the pre-merge head; the JVM is native ARM. No complete
verdict for this local check is claimed, and its deadline was retained.

The latest CI attempt (run 40106768270)
was rejected before its first job started with the same Actions-budget
annotation. Full verification therefore remains incomplete even though
the implementation's focused checks pass.

At the user's request, local verification now runs without computation
cutoffs. The local launcher selects `VERIFY_TIME_LIMITS=off`; bounded
verification remains available with `VERIFY_TIME_LIMITS=on`, and the CI
entrypoints retain their bounded default. The mode participates in Turbo's
cache key, so an unlimited local pass cannot satisfy a bounded CI check.
Run, task and model computation cutoffs are removed locally; assertions,
product timing requirements, exploration depth and model bounds are unchanged.

The first full local run in this mode completed 1,253 tasks successfully,
including all 80 model-proof tasks. The unchanged custom-game graph
completed its 811,080 states, twelve safety invariants and both temporal
properties. Quoridor's eight invariants passed at the unchanged two-step
bound, and all 58 Quoridor spec checks passed. These are partial results,
not a green full gate.

The release journey task was interrupted when the person stopped or
restarted the local stack, which they confirmed. Its parent received
SIGTERM; subsequent browser failures reported disconnected clients and
refused connections. The full runner ultimately exited 137, with that
task failed and 90 tasks unfinished. The diagnostics and task summary
were preserved, and two verified orphan API workers were stopped so the
interrupted task could close its output.

A separate owned package run is checking the 82 game slices left unfinished
by that interruption, using the official PR profile and one worker. At
2026-10-24 22:58 UTC, 39 slices had passing results, covering 1,764 tests,
with no reported failures. These partial results warm the cache for the
queued full gate; they do not establish its verdict.

A four-worker full local rerun is queued through normal host-wide admission.
No CI workflow was manually dispatched following the local-only request.
Local checks use
the working tree, including pre-existing auth edits; they are not evidence
of verification on the exact PR head. Full verification, person-facing
readiness and the CI attestation remain unproved until supported by the
appropriate completed runs.
