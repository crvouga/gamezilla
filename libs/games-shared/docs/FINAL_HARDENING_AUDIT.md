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
