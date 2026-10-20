# Final framework hardening audit

This is the independent follow-up to
[`FRAMEWORK_HARDENING_REPORT.md`](FRAMEWORK_HARDENING_REPORT.md), against
baseline `d8165972f`. The requested hardening is **in progress**. Historical
verification in that earlier report does not prove this change complete.
The implementation map remains [`GAME_FRAMEWORK.md`](GAME_FRAMEWORK.md).

## Findings and repairs

| Classification | Evidence at baseline | Repair and recurring check |
| --- | --- | --- |
| Proven defect: advertised implementations not validated | Registering `history: {}` or matchmaking without notices succeeded; custom games without bots produced a property-access error. Nine new malformed-input cases failed before the repair. | Validate functions, namespaces and bot choices before sessions are installed. `game-capability-missing-implementation`, pinned in `game-session-shared/tests/turn-game-contract.test.ts`. |
| Proven defect: execution can omit registered games | A plan with matching production and harness registries and `games: []` returned no problems. | Compare execution against enrollment; reject duplicate identities and substituted definitions. `game-conformance-execution-omission`, pinned in `games-harness/tests/game-conformance-plan.test.ts`. |
| Proven defect: incomplete suite can borrow capability coverage | An empty newly added rules suite passed planning when another rules suite covered the game. Misattributed cases also passed. | Require a case in every eligible suite, with additional capability requirements declared explicitly. `game-conformance-partial-suite`, pinned in the same planner test. |
| Proven defect: lower-level concrete engines unclassified | Five `pkgs/chess-*` manifests lacked game ownership, bypassing the manifest game-isolation guard. | Mark all five as Chess-owned; require ownership for game-named packages in both tiers. `concrete-engine-game-ownership`, pinned in `tools/scripts/game-dependency-graph.test.ts`. |
| Missing independence evidence | Existing reference-game execution did not build with production imports prohibited. | The core bundle rejects concrete sources and registries. `games-harness/tests/framework-independence.contract.test.ts` additionally executes client/server checks using only test-owned consumers, with production source loading prohibited. Its negative check must reject an attempted concrete import. `apps/client/tests/framework-build.test.ts` compiles the actual shared screens with the production Vite configuration and rejects both game and registry sources before transformation. |
| Proven defect: namespace authority inferred from concrete identity | `turn-game-definition.ts` compared the game id to `GAME_PLATFORM_NAMESPACE` to grant legacy unprefixed namespaces. | Use an explicit grant and enforce its owner at production composition. `game-registration-implicit-legacy-id` pins the old implicit privilege and a differently named granted consumer; the registry refuses another definition's claim. Stored identities remain unchanged. |
| Proven gate defect: package-owned audit docs rejected | The full gate rejected spec commit `e0d7afbda3` solely for `libs/games-shared/docs/PUZZLE_LAYOUT_SPEC_AUDIT.md`. | `spec-ownership-package-audit-docs` pins that commit input. The gate accepts Markdown only in root or declared package docs directories; source paths and non-Markdown files remain forbidden. All 14 ownership checks and the actual history gate pass after `15e5950cc`. |
| Proven remaining shape limits | `GameSide`, participant tuples, result types, shared room positions, and existing probe refusals require two alternating participants with public state. | Open. A refusal probe documents a limitation; it does not satisfy the requested support for meaningfully different shapes. |
| Proven defect: missing suite wrapper represented as empty enrollment | The real loader returned `{}` rather than `null` for a suite never calling `forEveryGame`, hiding the structural error when no game was eligible. | `game-conformance-unregistered-suite` creates that literal module and tests the actual loader; it failed before the repair. Unsupported capabilities legitimately require no cases, while an unregistered suite still fails. |
| Proven defect: faulty-consumer tests required Chess | The isolated run passed 199 checks but failed two falsification checks because their foreign examples came from Chess. | `game-conformance-fault-probes-production-default` uses independent test-owned foreign positions and puzzles, excludes the game under test, and retains assertions naming the exact rejected input. |

Four new planner sensitivity tests failed against the original planner;
all pass after the repair. Existing domain rules, historical bug ids and
counterexamples remain in place. This change has not yet independently
re-audited every historical regression or every retained game-specific
scenario.

## Dependency and source baseline

The executable graph check walks every workspace manifest's production
and development dependencies. A framework package cannot reach a game or
registry, and a game cannot reach another game or a registry. Breadth-first
traversal produces the shortest offending path and terminates on cycles.
Synthetic intermediary and cycle cases prove the guard detects violations.
The actual workspace check passes. Source import and public API checks
remain the package lint's responsibility; a graph check alone cannot
validate an undeclared or type-only source import.

The 13 non-registry framework API owners are `turn-game-shared`,
`turn-game-client`, `spaces-shared`, `game-session-shared`,
`game-session-client`, `game-session-server`, `game-session-harness`,
`game-matchmaking-shared`, `game-matchmaking-client`,
`game-matchmaking-harness`, `game-menu-client`, `game-puzzle-shared` and
`game-puzzle-client`. Their implementation dependency closures contained
no game or registry at baseline; no production import was removed merely
to improve a count.

Source counts before these repairs, unchanged by them:

| Owner | Feature files | Scenario headers | Quint models |
| --- | ---: | ---: | ---: |
| Shared games | 90 | 744 | 16 |
| Chess | 34 | 190 | 7 |
| Connect Four | 4 | 10 | 1 |

There were 19 authored shared code suites: rules 2, custom games 5,
matchmaking 2, history 2, puzzles 8. There are now 23, with four added or
promoted puzzle suites. The planner check produced this actual
enrollment matrix (counts include shared specification files and code
suites, **not executed scenario verdicts**):

| Consumer | Rules | Custom games | Matchmaking | History | Puzzles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chess | 2 | 41 | 44 | 9 | 55 |
| Connect Four | 2 | 39 | 42 | 9 | unsupported |
| Counting race, test-only | 2 | 37 | unsupported | 2 | 53 |

The independently executed planner, attribution and isolation checks
passed 34 tests. The dependency and package-boundary checks passed 29
tests. The shared registration, independent-room and isolated-build
checks passed 23 tests before the final metadata-driven builder revision;
that revision is included in the broader verification now required.
These targeted results do not establish the full matrix's behavioral pass.

## Reusable regressions restored to shared ownership

| Original id | Preserved counterexample and generalized evidence |
| --- | --- |
| `puzzle-concurrent-results-lost-rating` | The two original `puzzle-one` / `puzzle-two` results, 1500 starting rating, forced overlapping profile reads, and independent sequential-history assertion remain. The one shared suite now applies each eligible namespace and runs pool, dedicated-session and Bun SQL drivers: six cases passed for Chess and counting race. |
| `chess-puzzle-duplicate-rating-feedback` | Repeated fresh objects with equivalent completion values must emit one rating cue. The shared completion-feedback suite runs this for each puzzle consumer; Chess's original en-passant sound scenario remains. |
| `chess-puzzle-rating-feedback-late` | An initial unrated completion followed by its rated result must update the displayed rating and emit the late cue once. Repeated delivery must not emit it again. Both puzzle consumers pass; Chess's resumed en-passant scenario remains. |
| `chess-stats-host-auto-entry` | The original `games`, `loading` and `join` entry states remain. The driver regression now runs for every puzzle-capable game rather than hardcoding a Chess menu. |
| `puzzle-stored-mate-continues` | The original `7k/RR6/8/8/p7/8/8/6K1 w - - 0 2`, `b7b8`, and contradictory trailing `a4a3 b8c8` remain in the Chess check. The shared `terminal-objective` suite applies the same malformed continuation to every consumer’s known puzzle endings: a plugin’s winning result outranks a matching stored move with another reply. A non-winning move follows the stored continuation. No alternate-win trait is required. |

The shared feedback implementation now has one small reactive owner; its
unused animation wrapper and Chess-named props type were deleted without
aliases. The concurrency database fixture has one owner in
`sql-client-root-harness`, uses an injected in-memory object store, and
retains all three connection drivers. Chess's seven import checks moved
unchanged into its harness; their original bug ids and proof pointers were
preserved. No shared test now imports that setup from a concrete game.

The working inventory at `.cache/game-framework-hardening/inventory.json`
lists 328 package manifests, 185 specifications across games, Chess,
Chess board and Connect Four, and 192 related regression records at that
checkpoint. All proof paths existed. Five historical regressions were
individually reviewed in this continuation; file presence is not proof
that the remaining records exercise their original failure mechanisms.

## Independent consumer execution

The test-only composition supplies the existing setup-race consumer through
the same shared, client and harness registry exports as an application.
Its rules and fixtures consume public framework modules; it required no
change inside a suite or a screen. The full shared code-suite directory,
faulty reference consumers, matrix checks, and the canonical
`custom-games.feature` and `game-turns.feature` execute with production
game source loading forbidden. The counting reference consumer remains
beside it. The latest successful run executed 202 checks, including 48 shared
feature instances. Unsupported matchmaking requires no cases in this
composition.

Setup-race is 157 lines; its reusable test-only button surface,
presentation and automation helpers are 76 lines, and the shared counting
rules helper 96. These are test assets, not new production games. The
mechanism replaces composition exports only; the consumers use ordinary
`defineTurnGame`, `defineGameClient` and checked fixture registration.
The isolation proof is the package's existing `test:contract` task kind,
included in both verification profiles. Scratch feature stubs use the
standard Gherkin bridge and are removed; no feature copy or new retained
report is added. Complete replay of every applicable shared model and
feature for this extra consumer remains open.

The web build proof uses `apps/client/vite.config.mts`, including the real
Solid and localization transforms, to bundle the public `GameMenu` and
`defineGameClient` with an empty `createTurnGames([])` catalog. It asserts
that menu, custom-game, history, matchmaking, puzzle-play, puzzle-review
and puzzle-stats source modules occur in the emitted chunks. A Vite load
guard resolves source ownership from manifests and refuses every concrete
game or registry before transformation and tree-shaking. The application
package's one test entry is the only exception; application production
sources remain forbidden. Two negative builds exercise a concrete source
chosen by ownership metadata and the real client registry. Bundles stay in
memory; this runs no browser, server or manual verification. This proves the
shared client implementation under the shipping toolchain, not an empty
version of the whole product application: runtime composition still owns
its production games and their additional product-specific subs.

## Compatibility, cost and outstanding acceptance work

No durable schema, mutation, room message, state encoding or stored name
changed. Registration rejects malformed integrations earlier. The API
change to code-suite registration is internal to the framework harness;
games supply no new fixtures or adapter methods. The isolated proof
extracts the existing shared package's counting fixture instead of copying
a production game. The richer counting-race consumer remains enrolled in
the existing shared suites and specifications.

The legacy Chess definition now explicitly supplies the namespace grant
that registration previously inferred from its id. Production composition
reserves that grant for the same definition. The new namespace regression
failed before the change; registration and registry checks then passed
23 tests across the two contract files.

Latest package verification:

| Command | Outcome |
| --- | --- |
| `bunx turbo run tc lint test --filter=@libs/game-session-shared --filter=@libs/games-shared --filter=@libs/chess-sub-shared` | 8 tasks passed, including the metadata-driven isolated builder and the explicit namespace grant. |
| Focused planner, matrix, attribution and order-isolation files in `@libs/games-harness` | 34 tests passed. |
| `bun test libs/tools/scripts/game-dependency-graph.test.ts libs/tools/scripts/package-boundaries.test.ts` | 29 tests passed. |
| Broader `tc lint test` for game session, turn game, shared conformance and tooling | 10 tasks completed; the repository's startup cleanup interrupted the two remaining test tasks. This was not a green complete run. |
| `bun verify` | Failed in `@libs/tools#verify:actionlint`: the unchanged deploy workflow's YAML alias is rejected at lines 160 and 170. The run stopped before completing the gate. |
| `bun verify --continue=dependencies-successful` | Exited 124 after the unchanged 600-second global deadline, with a matchmaking model task running. The workflow alias also failed. Finished tasks were cached; no complete Turbo summary or per-task budget verdict was produced. No timeout was raised or gate weakened. |
| Promoted concurrency suite and matrix | 16 tests passed, including all six game × SQL-driver race cases. |
| Moved Chess import checks | Seven tests passed. |
| Promoted feedback, stats navigation, planner and matrix checks | 38 tests passed. |
| Zero-production-game execution | 201 child checks and both parent isolation checks passed. |
| Latest affected-package type checking and lint | All 12 tasks passed after task separation and the foreign-peer fix. |
| Latest `test test:contract` across games harness, puzzle client, Chess harness/server and SQL harness | All six tasks passed. The shared harness ran 344 ordinary checks and the isolated composition ran 201 checks within its two parent contract checks. Four unchanged tasks restored exact-input cache entries. |
| Latest `tc lint test test:contract` for games harness and web client | All seven tasks passed (three exact-input cache hits), in 87.662 seconds. The shared harness ran 346 checks, the isolated composition ran 202 checks within its two parent contract checks, and the web client ran 15 checks including three production-toolchain build checks. |
| `bun verify` after the shared-client build and terminal-result promotion | Failed again on the unchanged deploy YAML alias at lines 160 and 170; all five preparation tasks passed and the full gate stopped in actionlint. This snapshot contains the new tests. Diagnostics: `verify-run-odo1oO/diagnostics.tar.gz` in the local temporary directory. |
| Concrete engine/board package lint | All five tasks passed after declaring game ownership. |
| Dependency graph, boundaries, task-runner policy, test ownership and regression-register checks | All 64 tests passed again after the web-client dependencies, cache inputs and regression pointer changed. |

An initial broader check found a test fixture violating TypeScript's exact
optional-property rules. The fixture now removes the field rather than
assigning `undefined`; its package type check passed in the subsequent
10-task partial run.

The web client test hashes every ownership manifest, so reclassifying a
package cannot reuse an earlier isolation verdict. Its complete 15-check
task took 5.15 seconds; the positive shared-screen bundle took 3.01 seconds.
No runtime dispatch, storage schema or UI flow changed for this build proof.

The core test's cache key additionally includes the negative builder's
registry manifest and entrypoint. The tooling graph test hashes workspace
manifests, not every game's source. The existing shared harness package
still reruns all enrolled games together when a production game changes;
granular per-game conformance caching remains open.
Its matrix and isolation tasks now explicitly hash shared specification
files and ownership manifests, so a newly added shared scenario or changed
ownership cannot reuse an unrelated earlier pass.

The full PR gate is `bun verify`, and nightly is `bun verify-nightly`, as
defined by the current repository. Full verification, deeper applicable
verification, an independently reviewed spec/regression ownership ledger,
the distinct game-shape
contracts and privacy guarantees, and the final requirement-by-requirement
acceptance audit remain necessary. This document makes no completion,
Swift parity, production readiness or full conformance claim.

The full package run also found a fixture-wiring error introduced during
the foreign-input repair: setup-race was compared against itself. The
fixture now excludes matching game ids, and the setup and faulty-consumer
checks pass together (20 tests). The complete affected-package rerun after
this fix and task separation passed, as recorded above.

## Solver-only puzzles: implementation in progress

`e0d7afbda` is the spec-first change for solver-only puzzles. Common
progress and review now refer to the solver's moves. One shared
`puzzle-opponent.feature` retains the setup, automatic reply and refused
opponent input obligations only where an opponent exists. The known puzzle
still has two solver moves. The two existing models use a boolean
`OPPONENT` constant; its execution is now verified as recorded below.
The detailed source audit is [`PUZZLE_LAYOUT_SPEC_AUDIT.md`](PUZZLE_LAYOUT_SPEC_AUDIT.md),
which explicitly remains incomplete, including full status coverage and the
nine strict wording collisions.

The initial scenario command failed during enrollment of the new feature;
that was scaffolding, not valid red evidence. After enrollment, the seven
changed features executed 96 checks: 58 passed and 38 failed on undefined
replacement steps. The subsequent rebound run exposed six failures from a
new binding reading a nonexistent probe field. It now captures the visible
current position before review instead of inventing a hidden frontier read.

The focused core counterexample uses `pile:4:white`, `take2 take2`, with one
solver throughout. All three initial setup/staging checks failed before
repair. A separate room example first passed normal start and completion,
then failed stepping from the first move back to the supplied position as
`already at puzzle start`. Both bugs have their own register entries and
literal examples. The core package's 237 checks subsequently passed,
including start at zero, two explicit solver moves, one clean solved result,
review back to zero, and complete solution animation from zero.

The public capability now declares `lineMode` with the existing
`opponent-replies` default and a `solver-only` alternative. Setup, room
progress, seeking, transposition stride and staging use its declared layout;
no game id or position syntax selects a branch. This is not yet full
single-player support. Client navigation and review bounds, fixture and
rules conformance, a truthful solver-only board/feedback consumer, automatic
suite enrollment and solver-only implementation replay remain required. No production
game advertises the new mode. Existing durable event shapes and names are
retained; the new setup result reports its actual starting index.

One package run completed 16 of 17 tasks and found a planner error-message
expectation missing the new opponent trait. The expectation was corrected.
A stale subsequent run was stopped through the documented supervisor stop
entry point before its verdict could be used; it is not verification proof.
The next run uses settled source inputs.

After the planner expectation and review binding fixes, all 17 affected
`tc lint test` tasks passed (14 exact-input cache hits) in 76.986 seconds.
The seven changed feature files then passed all 134 checks for Chess and
the counting reference consumer in 79.89 seconds. The earlier red run's
first-error stopping policy ended after 96 checks; it does not claim that
all 134 had executed red. These feature results establish the rebound
existing consumers, not an enrolled solo consumer or the parameterized
models. The core package ran 237 checks and the shared code harness 346.

The ordinary `bun run spec:verify` passed after catalog regeneration. Its
strict form still fails on exactly the nine previously recorded wording
pairs, with no new pair from these bindings. All 64 dependency, boundary,
task-policy, test-ownership and regression-register checks passed.
An explicit run of the two changed models type-checked and passed shape
checks, but trace generation failed with `QNT500: Uninitialized const
OPPONENT`. This identified the runner gap subsequently closed below; the
seven passing feature files did not substitute for model execution.

The first full gate of this implementation checkpoint stopped at that
package-doc ownership defect (`verify-run-10YGkt/diagnostics.tar.gz`).
After the pinned repair in `15e5950cc`, tooling type checking, lint and the
history ownership task all passed. All six policy test files then passed
78 tests, including the 14 ownership checks. A fresh `bun verify` stopped
again at the unchanged deploy YAML alias at lines 160 and 170
(`verify-run-AiVT29/diagnostics.tar.gz`). Neither full run is green, and
neither establishes parameterized model or full-context behavioral success.

## Fixed model inputs: execution checkpoint

The Quint runner now accepts fixed boolean inputs declared in the main
module. Each trace variant assigns every declared input. Games derive
`OPPONENT` from their declared puzzle layout in the harness composition
entry, without a model copy or a concrete-game branch in the runner.
Private compiler inputs close constants as literal pure values while
preserving imports, action definitions and the authored source. A native
Quint module-instantiation comparison checks that transformation.

Assignments have separate trace cache keys and replay plans; unparameterized
models retain their existing cache identity. Subjects sharing an assignment
share a draw, but each receives its own action cover, pinned histories,
determinism check and implementation evidence. A two-slice, three-subject
probe checks actual replay counts and evidence for both input values.
Missing assignments, unknown inputs, wrong types and duplicate subject ids
fail. `quint-uninitialized-model-constant` retains the original executable
runner failure in the bug register.

Both proof paths enumerate every boolean combination, including values
without a registered product consumer, within the existing total deadline.
`verify:models:10` passed the attempt model's two complete TLC graphs:
14,422 states for `OPPONENT=false`, 17,626 for `true`, each with depth 20
(18.8 seconds combined). `verify:models:14` passed every sound invariant
within the existing four-step bound for both values (12.5 seconds combined).
The two tasks completed in 19.576 seconds. No proof budget was raised.

Regenerating all sixteen game replay plans changed only the two newly
parameterized entries. Existing puzzle trace covers and replay counts are
unchanged. Running both models through `bun run spec` then passed all 20
checks in 49.17 seconds for Chess and the counting reference consumer.
These consumers both declare the opponent layout. This is not solver-only
product replay: client navigation, fixture and rules checks, a real solo
board with feedback, and its automatic shared-suite enrollment remain open.
The source/spec audit also remains INCOMPLETE.

The affected four packages' twelve type, lint and test tasks passed during
implementation, including 157 Quint checks, 346 game-harness checks and 97
harness checks. A fresh `bun verify` passed preparation and stopped on the
same unchanged deploy YAML alias at lines 160/170. Diagnostics are archived
in `verify-run-JwHcDg/diagnostics.tar.gz`; the gate is not green. The final
four-package follow-up passed all twelve tasks with no cache hits in
131.065 seconds: 637 tests total (157 Quint server, 37 Quint shared, 346
game harness, 97 harness). These targeted results are not a full repository
verdict.

## Solver-only navigation checkpoint

Two literal controller failures are now pinned:
`solo-puzzle-navigation-excludes-start` (index one cannot go back to zero)
and `solo-puzzle-review-cursor-zero-unset` (`solo-count:3w`, `two two`, cursor
zero jumps to the end). The first focused run had three failures and one
pass; the room projection distinction also failed separately before repair.

Navigation requires the declared `firstSolveIdx`; the universal constant was
deleted and all callers updated. Play controls, history and review use the
same capability layout. The existing selection message still uses integer
zero to request the end, and seek messages retain their integer payloads.
Its derived room cursor is now nullable so an unset selection and a sought
zero differ. Review displays the end for null without publishing a seek.
An older opponent cursor at zero still displays the end. Controller tests
cover mounting, shared cursor updates, Home, Forward and that legacy case.
No database rows or recorded message shapes changed.

All nine affected package tasks passed (six exact-input cache hits) in
74.269 seconds: 240 shared puzzle, five client and 351 game-harness tests.
The seven shared feature files plus the two common models passed all 154
checks in 70.85 seconds. The UI detector reported no findings. The isolated
framework contract passed again in 66.594 seconds, including 202 checks in
the test-only composition and the hidden-concrete-source negative control.

`bun verify-nightly random` found a tooling property timeout, seed
419327699 at 200 cases, reported shrunk input `[]`. It started Bash for each
sample. The corrected test reuses one owned shell, preserves both assertions
and the five-second deadline, pins `[]`, and still executes the actual
workflow script. The original seed passed 200 cases, with the property
finishing in 0.29 seconds. Tooling type/lint/test checks passed all 773
tests, also catching and correcting one missed import of the moved Quint
module-name helper and regenerating the stale measured CI section.

The failed nightly run was stopped through `bun run stop`; its longer fuzz
and mutant tasks are not claimed as completed. The corrected fresh-seed
property task then passed all 155 files at 200 runs per property, seed
1032991361, in 16.2 seconds. This is a passing property task, not a passing
whole nightly group. Solo fixture validation, truthful board feedback and
automatic shared-suite enrollment remain required; the larger audit stays
INCOMPLETE.

The navigation checkpoint's fresh full `bun verify` again stopped at the
unchanged deploy YAML alias at lines 160/170. Its complete diagnostic archive
is `verify-run-GfskPh/diagnostics.tar.gz`. Targeted successes above do not
clear that full-gate failure.

## Solver-only consumer enrollment checkpoint

The test-only `solo-count` consumer now declares `solver-only` and passes
`assertHarnessGame`, with three known two-action puzzles and thirty further
distinct puzzles. It has no second participant or recognized second-side
positions. Its board exposes real gestures and marks, and its registered
audio cues are actually emitted through the audio port. A deliberate legal
`stay` action provides a wrong move even where the three advancing actions
are all correct; seed `0x67932`, attempt trace 44, step 2 exposed that missing
probe input. Its literal opening is pinned separately.

Fixture checks, judge/playback laws, room and board suites, action helpers,
and transposition expectations now use the declared layout. Opponent input
remains mandatory for opponent fixtures and is forbidden for solo fixtures.
The first focused shared puzzle run had 13 failures; after parameterizing
the expectations, all 197 checks passed. Alternation and the opportunity for
both sides to win are still mandatory for head-to-head capabilities, with
the nonalternating duel retained as a refusing control.

The solo consumer is enrolled once in `CONFORMANCE_GAMES`, inheriting the
rules and puzzle matrix without per-suite registrations. Its attempt cover
is `[21, 38, 43]`, its sound cover `[0, 6]`, with assignment-specific evidence
and unchanged trace budgets. Actual shared attempt and sound replay passed
all 29 checks in 58.83 seconds, including both layouts. The complete command
took 62.309 seconds. Neither a capability refusal nor planned enrollment is
being counted as an execution result.

Those traces also exposed a silent first correct move, selection of a
nonexistent negative ply for position zero, and a game-menu observer tied to
the presence of custom games. Each has a literal failing example and its
own bug-register entry. Feedback now distinguishes uninitialized progress
from zero; zero selection uses the existing start control and leaves an
already selected position alone; the menu exposes its own stable identifier.
The focused audio and navigation regressions pass. Full inherited feature
and remaining model execution, refreshed package checks, the isolated build
and the repository gate are pending at this checkpoint. The larger mission
and spec audit remain INCOMPLETE.

The first broad run selected all 32 `puzzle-*.feature` files plus feed, link
and result-recovery models. It stopped with 292 passes and ten failures
(302 checks executed, 342.10 seconds); it is not a green inherited-spec
verdict. Failures exposed a finish-on-close helper's stride, a hearing
assertion that demanded an absent opponent reply, an incomplete probe theme
menu, a themed-pool precondition that discarded the puzzle already on the
board, and game-owned personal-stat wrappers. The longer offline catalogue
sequence exposed the redundant presence commands described below.

Personal stats are now derived in the framework from registered puzzle
clients. The Chess and reference wrappers were deleted; production retains
the same Chess route, screen and sub-client names. The solo consumer's
focused test opens personal stats with no game-owned slice and reviews a
completed puzzle at its end. It found and pinned one more zero/unset cursor
failure in the personal surface, now corrected. Focused personal stats,
finish-on-close and two longer offline-line checks passed (three checks in
8.34 seconds). Final broader verification remains pending. Type/lint checks
also found and removed the now-unused Chess sub-client dependency.

The thirty-puzzle, three-day offline example filled the unchanged
256-command queue with redundant `mark-quiet(false)` commands sent for every
pointer gesture. The presence host now sends a quiet mark only when that
device's room mark changes, while still updating its local mark and resetting
the activity timer. The literal two-line queue example and complete
thirty-puzzle sequence pass; no queue limit or time budget increased.
Positive idle/wake behavior still requires the existing presence specs.

The ordinary game-harness run passed all 446 checks across 59 files with
6,158 assertions. Its measured 491.91 seconds exceed the gate's unchanged
300-second task budget, so this success alone cannot clear the gate.
The same shared contracts now have five existing numeric contract-task
slots, one per conformance area, beside ordinary tests and the independent
composition check. Every eligible game remains enrolled in each applicable
suite. These tasks retain the inherited task budgets; their execution and
coverage checks are pending. Their cache inputs include shared fixtures,
composition, ownership manifests and their own area. Per-game dependency
invalidation remains open.

Personal-stat registration also exposed a static-route inspection limit.
The verifier now follows explicit client-array factories and local route
constants without importing product code. It requires chart ownership of
the generic route family and still rejects dynamic paths and cycles.
The separate spec commits `ae7064e5b` and `8eb60b721` map that family and the
previously orphaned opponent-only contract. Statechart and ordinary spec
verification passed together. The strict check still reports the same nine
wording pairs; it is not green.

The UI detector found no issues in the changed shared menu, stats, feedback
and presence files. The pinned action linter and its actual entrypoint pass
all four workflow sources directly. The previously recorded frozen full-gate
failure needs a fresh frozen run; it is no longer assumed to prove that the
workflow source itself is rejected. Full inherited specs, isolated execution,
split package tasks and the repository gate remain pending.

The split execution preserves all 446 checks: ordinary tests 140, rules 59,
custom games 27, matchmaking 18, history 5 and puzzles 197. The completed
area tasks took 35.19–81.18 seconds, and ordinary tests took 164.39 seconds,
all below 300 seconds. The tooling run passed 776 tests at local Verify's
single-task concurrency after regenerating the CI task-count section.
An earlier broad parallel run had two five-second source-scan timeouts and
the expected stale-document failure; it is not a passing result.

The larger isolated consumer run hit its original 150-second child lifetime
near the end of the shared turn examples. Separating code checks from
features passed 233 isolated code checks, 48 feature examples and the
hidden-dependency negative control, with explicit solo rules/puzzle output
assertions. The feature worker took 141.69 seconds; each canonical feature
now gets its own bounded worker. Both child and task deadlines are unchanged.
The final partitioned proof passed: 233 code checks in 14.72 seconds,
24 custom-game examples in 100.40 seconds, 24 turn examples in 115.87
seconds and the hidden-dependency refusal in 0.22 seconds. Its complete
task took 236.09 seconds, below 300. The two packages' six final type,
lint and test tasks passed in 258.33 seconds without cache hits.

The production-toolchain proof now also requires personal-stat registration
and its shared account screen in the actual emitted chunks. That stronger
check failed against the old isolated entry because registration was absent.
Exporting the common factory from that zero-game entry then passed all 15
client tests, including both forbidden-source build controls. No production
game or registry source is permitted to load for this build.

The complete selection of 43 puzzle contracts plus two presence features
started at the unsplit CLI's ten-worker default. The presence portion passed
all 18 checks. At cancellation the invocation had 61 passing checks and
four timeouts: the 64-step solo attempt trace 39 (180 seconds), opponent
sound trace 1 (240 seconds), the pinned quota-publication link history
(180 seconds), and the Chess repeat-puzzle rating example (240 seconds).
Simple process/file reads also stalled under this invocation. It was stopped
through `bun run stop` and is not a passing complete-spec result. Follow-up
runs use local Verify's documented `VERIFY_TEST_CONCURRENCY=1`, retaining
the same traces, properties and deadlines. Idle/wake, multi-device and
reconnection features require their own execution, beyond presence navigation.

The single-worker follow-up passed all 27 idle/wake, multi-device,
connection-loss/return and host-departure scenarios in 84.83 seconds.
The first fresh full gate then stopped at the stale translation catalog
(`verify-run-j1cllL/diagnostics.tar.gz`): moving the common stats removed an
unused title and changed macro origins. Extraction, compilation and the
catalog verification pass after refreshing the tracked `.po`; generated
TypeScript remains ignored.

The old workflow-alias failure is now explained by a proven tool-selection
defect. In the verification environment `mise exec` ran actionlint 1.7.7,
while `mise which` selected the declared 1.7.12. Commit `4524d7866` resolves
and runs that absolute executable, rejecting failed or relative selections.
Three actual launcher tests failed against the old adapter and pass after
the repair. All six tooling tasks then passed under the gate's secret-loaded
environment, including the real four-workflow lint, goal-register validation,
catalog validation, type/lint checks and all 779 unit tests. No workflow,
tool-version pin, dependency or linter rule changed.

The next full `bun verify` stopped at its unchanged 600-second deadline
with `@libs/games-harness#verify:models:3` running for 43 seconds. It reported
no assertion failure, but no Turbo summary survived the kill, so per-task
budgets were not verified. Diagnostics are
`verify-run-T3oVQm/diagnostics.tar.gz`; this is not a green full gate.
The continuation uses two task/solver slots and one product-test worker,
retaining all bounds and deadlines. Full puzzle/context execution and the
broader mission remain open.

The two-slot continuation (`verify-run-SYF9l8`) completed 106 successful
tasks, including three restored verdicts, before the same 600-second run
deadline. Turbo retained a summary; no assertion failure was reported.
Completed proofs included the formerly interrupted game model part 3 and
both matchmaking proof parts. The full gate still exited 124. The subsequent
ownership baseline passed six Chess board/material examples and 48 shared
side-selection examples (54 checks total). Seat placement is absent before
start by design, so it cannot replace the draft board-orientation assertion;
that guarantee must remain until a suitable shared board contract owns it.

## Review ownership follow-up

The matched-game listener example is now specified once in Games. Its
original Chess example selected `e4` after `e4, e5`; the common example
selects each game's known first move and requires hearing that move in the
earlier-position description. Binding and sensitivity evidence remain open
in [`MATCHED_REVIEW_OWNERSHIP_AUDIT.md`](MATCHED_REVIEW_OWNERSHIP_AUDIT.md).

The `puzzle-solved-review-resumes` scenario also belongs to Games: none of
its observations mentions the assistant, Chess pieces or notation. Its
exact command sequence is retained: solve, review an earlier position,
leave for the game's choices, return; the earlier puzzle must not be
offered again. The shared attempt-resume feature now owns the original
regression tag. The existing parameterized room-session example retains
its literal regression marker and solved-status assertions. Updating the
register's proof pointer and executing the promoted feature for every
puzzle consumer remain implementation work.

The promotion adds no term, command, status or model guard. All step
phrases already exist in Games. `puzzle-attempt.qnt` remains the aggregate;
the existing finished-return transition is exercised with its viewed
position behind the solved frontier. The Rule's unfinished-return example
still proves the counter-case. Language and feature checks A0–A6,
B1–B17 and D1 retain the same findings as the puzzle-layout audit: this
example is eight steps including its factual Background, a length warning
whose extra setup preserves the original bug mechanism. The full C4 map,
strict duplicates and execution obligations are still open. This is an
ownership correction, not a completed audit verdict.
