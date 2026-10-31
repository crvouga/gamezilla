# Add Battleship Through the Game Framework

## Goal-mode mission

Implement **one complete, production-ready Battleship vertical slice** in the existing product repository, using the hardened game framework and its supported plugin contracts.

This is both a real product addition and a concrete validation of the framework. Success means that Battleship works end to end **because it inherits the platform**, not because it recreates the platform inside a Battleship package.

**The framework must remain completely independent of every concrete game. Games depend on its public contracts; the framework must never depend on Battleship, Chess, Connect Four, or their private implementations.**

The framework should do almost all the application-level work. Battleship supplies its distinctive rules, private fleet setup, participant views, board interactions, assets, bot strategy, and minimal domain fixtures. Shared screens, workflows, lifecycle coordination, permissions integration, persistence, and applicable specifications and tests must be reused.

Work through discovery, specification changes, implementation, integration, testing, cleanup, and verification. Do not stop after a design, a local board demo, or a partial implementation. Make routine engineering decisions from the repository and the requirements below without asking for routine confirmation. Respect the repository's safety, commit, branch, and deployment rules.

This is an implementation task, **not another open-ended framework rewrite**. Extend shared contracts only where a demonstrated requirement cannot be expressed correctly through the current API.

---

## 1. Read the repository and establish specification authority

Read `AGENTS.md`, the current repository briefing, specification-writing conventions, the game-framework API and new-game guide, relevant package documentation, existing game registrations, and the actual implementation before editing.

The complete supplied **Battleship Game Specification** is included in Appendix A. It is part of this prompt, not background material. Preserve its requirement identifiers, mandatory scenarios, property requirements, scope boundaries, and definition of done.

Use these authorities:

- Existing executable product specifications govern shared application behavior and product policy.
- Appendix A governs Battleship's rules, hidden-information policy, and required integration outcomes.
- This directive adds the framework-ownership, reuse, implementation-process, and evidence requirements discussed for this rollout. It does not introduce new gameplay variants.

Explicitly resolve these scope details:

1. The confirmed starting games are **Chess** and **Connect Four**. Chess supports custom games, matchmaking, and puzzles. Connect Four supports custom games and matchmaking, not puzzles.
2. The supplied material also names Quoridor and Tic-Tac-Toe as siblings. Do not assume those games exist. Preserve all games actually present; do not implement additional games merely because the attachment names them.
3. Battleship must support custom games and matchmaking, together with its required multiplayer, bots, lifecycle, history, replay, and privacy behavior. **Battleship puzzles are not requested.** Do not add a puzzle capability or require puzzle fixtures.
4. Optional language such as “where supported,” “where enabled,” and “MAY” remains conditional. Assess it against the actual platform; do not silently convert mandatory behavior into an optional capability.
5. This task does not require a new Swift client, a new server language, or a new cross-language toolchain. Preserve existing portable-contract boundaries and validate existing supported implementations where applicable.

If source requirements and repository policy conflict, record the specific conflict and its resolution. Do not silently change Battleship rules, entitlement policy, privacy, or existing game behavior to simplify implementation. An unresolved security or product-policy conflict is an explicit blocker, not an invented exception.

Create a traceable implementation checklist mapping Appendix A's `BS-*` and `P-*` identifiers and mandatory scenario groups to their owning specifications, implementation, and verification. Link requirements to canonical shared specs when they are shared; do not copy the requirements into competing executable sources of truth.

## 2. Discover what already exists before adding anything

Inspect the current implementations of:

- Plugin registration, capabilities, configuration, routes, navigation, and shared screen composition.
- Custom games, invitations, participants, matchmaking, spaces, room authority, readiness, clocks, termination, and rematches.
- Bots, deterministic ports, persistence, history, replay, statistics, authorization, telemetry, and live checks.
- Shared Gherkin, Quint, property tests, harnesses, conformance discovery, browser drivers, evidence reporting, package boundaries, and CI tasks.

Identify exactly which responsibilities Battleship can inherit and which genuinely require an extension. Inspect code and tests, not just documentation.

Keep a short framework-change ledger. For each shared change, record the demonstrated missing contract or defect, its game-independent solution, compatibility impact, and shared verification added. Authorized registration and composition wiring are not architectural failures.

Do not impose an artificial zero-framework-change target. A reusable private-view or setup-phase capability may legitimately be missing. The failure would be a Battleship-specific branch, a copied workflow, or a redesign that disrupts unrelated games.

## 3. Integrate a plugin, not a parallel application

Use the existing, explicit plugin mechanism. Do not invent a runtime plugin marketplace, dynamic code loader, or competing registry.

The shared framework remains opinionated about application behavior. There must be one canonical implementation of applicable menus, matchmaking, custom-game orchestration, result presentation, history navigation, recovery, and common controls. Battleship must consume those implementations.

Battleship may provide game-specific configuration, legal actions, transitions, phase semantics, role-aware views, play surfaces, controls in documented slots, result interpretation, and bot strategy. It must not replace whole shared workflows merely to customize a board or setup interaction.

Enforce these boundaries:

- No framework imports from concrete game implementations, directly or transitively.
- No imports from Battleship into Chess or Connect Four, or from Battleship into their internals.
- No `gameId === 'battleship'` exceptions in generic screens, workflows, synchronization, or shared test suites.
- Concrete game wiring belongs only in authorized composition and integration boundaries.
- Generic framework packages remain product-agnostic; product policy stays in its existing product owners.
- Rules remain deterministic and independent of rendering, networking, and wall I/O.
- Production packages do not depend on harness packages.

Keep plugin contracts small, typed, documented, and enforceable. Avoid god interfaces, arbitrary hook chains, optional-method bags, unsafe casts, private API access, service locators, duplicated registries, and configuration that makes every game rebuild its own application.

A shared framework improvement must automatically reach every applicable game. Do not copy shared implementations into the plugin or introduce per-game forks that prevent fixes and UX improvements from propagating.

Preserve the repository's package layout, runtime categories, exports, naming, state ownership, and composition conventions. Do not introduce new services, databases, dependencies, or infrastructure without a demonstrated requirement that existing facilities cannot meet.

## 4. Treat private information as an authority boundary

Battleship's decisive architectural requirement is **recipient-authorized state**, not hiding ship graphics.

A trusted authority must validate both fleets and resolve shots. Each client and bot receives only its authorized view. Do not give an opposing participant or spectator full canonical state and filter it locally. A host or game creator is not automatically entitled to both fleets.

Audit the actual room architecture. If its current optimistic simulation or broadcast contract assumes every client holds identical full state, introduce the smallest cohesive, game-independent private-view extension. Preserve the established public-state behavior of Chess and Connect Four.

Specify and test the ownership of canonical state, public observations, participant-private observations, command validation, and view projection. Apply authorization before serialization and fanout, not only before rendering.

Cover every relevant exposure surface: initial loads, commands and responses, room events, subscriptions, snapshots, reconnect catch-up, queries, sync rows, client persistence, history, replay, exports if present, errors, logs, traces, and debugging output. Inspect actual recipient-visible payloads in addition to testing projection helpers.

Do not leak private placement data through shared randomization seeds, serialized internals, canonical-state fingerprints that expose hidden differences, or overly detailed validation errors. Keep internal determinism and integrity checks without publishing unauthorized information.

### Historical privacy is explicit

Appendix A's default is **no automatic full-fleet reveal after completion**. A player may see their own fleet and information legitimately revealed during play. Completion, resignation, cancellation, replay seeking, and switching a requested perspective do not grant new access to the opponent's unrevealed fleet.

Canonical private history may be retained by an authorized backend for reconstruction. That is distinct from the history a client is permitted to receive. Replay authorization must use the authenticated viewer, not trust a caller-supplied player identity.

### Local-first behavior must not defeat secrecy

Preserve existing offline and local-first guarantees for other games. For remote Battleship, do not preload the opponent's fleet or fabricate authoritative hit/miss results to simulate offline progress. Apply explicit supported pending, rejected, reconnect, and recovery behavior.

Local shared-device play is conditional on a deliberate privacy-preserving handoff. Do not describe a handoff screen as protection against a hostile person controlling the device. Do not offer an unsafe mode or mark a mandatory remote capability unsupported to avoid implementation.

## 5. Implement the exact rules in Appendix A

Use the complete specification, including the following anchors:

- Two players; one 10×10 board per player.
- Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2: five distinct ships and 17 occupied cells.
- Straight contiguous horizontal or vertical ships, within bounds, with no overlap. Orthogonal and diagonal adjacency are allowed.
- Private, independently editable setup. Complete valid fleets are required for readiness. Confirmed fleets are locked while readiness is committed and during combat.
- Unready behavior applies only when the existing lifecycle permits it before combat. Combat begins once both players and all required session conditions are ready.
- The existing first-turn policy assigns exactly one first shooter.
- One previously untargeted, in-bounds opponent cell per combat turn. Accepted nonterminal hits and misses both alternate the turn. No passing or bonus turn.
- Shot acceptance, hit/miss resolution, sinking, victory detection, and turn advancement are one logically atomic transition.
- Sinking occurs exactly when a ship's cells have all been hit. The public result discloses the permitted sunk-ship identity, not unrelated hidden cells.
- The final fleet hit ends the match immediately. No ordinary board-play draw, post-terminal actions, moving ships, Salvo, or other unrequested variants.
- Invalid actions leave canonical gameplay state and accepted history unchanged.

Distinguish a retransmission of the same command from a new attempt to shoot a previously targeted cell. Retransmission must not duplicate effects; a new illegal shot must not consume a turn.

Use existing injected time, randomness, identifiers, and scheduling controls. Random fleet generation must always produce a legal fleet; do not impose an unstated uniform-distribution requirement. Keep production secrecy distinct from deterministic test reproducibility.

## 6. Deliver all required application integrations

Implement the complete existing-platform integration, not just fleet placement and firing:

- Discovery, menus, routes, instructions, and capability-driven mode availability.
- Human/human, human/bot, bot/human, and bot/bot custom games through shared participant contracts.
- Remote invitations, joining, readiness, presence, spaces, and room lifecycle.
- Matchmaking that isolates Battleship queues and initializes the private setup phase after assignment.
- Manual placement, rotation, editing before confirmation, random legal placement, and readiness.
- Combat, damage, sinking, results, resignation, applicable clocks, disconnection recovery, cancellation, abandonment, and rematches under existing policies.
- Durable history, authorized replay, applicable profile statistics, and stable ruleset interpretation.
- Existing identity, guest, membership, entitlement, and denial UX.
- Existing observability, deployment integration, and safe synthetic checks.

Matchmaking acceptance, setup readiness, and combat turn ownership are different concepts. Compose them through explicit shared contracts rather than treating placement as alternating combat turns.

A rematch is a new match with fresh private setup, new lifecycle ownership, and its own historical record. It must not reuse old shots, ready flags, running bot work, or leak prior private state.

Do not create game-specific permission systems, history services, transport APIs, clock implementations, or matchmaking engines. Extend the responsible shared owner where necessary.

## 7. Keep the UI consistent while making Battleship usable

Reuse the framework's menu, matchmaking, custom-game, gameplay, results, history, and review screens. Inject Battleship's setup board, own-fleet board, targeting grid, and narrowly scoped game controls.

Follow the existing design system and client conventions. Do not implement a separate app theme, navigation system, or copied screen shell.

Provide clear placement validity, remaining ships, rotation, randomization, readiness, turn ownership, legal targets, last attack, hit/miss/sunk states, and terminal results. Show only authorized fleet information.

Make the two-board experience practical on small screens. Preserve context when switching views. Support touch, mouse, keyboard, screen readers, non-color-only status cues, and reduced motion. A drag gesture cannot be the only way to place a ship.

Use immediate safe input feedback without asserting a secret-dependent outcome before the authority resolves it. Animations never decide state transitions, authorization, or when a turn becomes valid.

Use existing performance and accessibility budgets, browser journeys, and visual checks. Validate the real application path, not just isolated board screenshots.

## 8. Integrate fair, autonomous bots

Bots use the same participant, configuration, lifecycle, and action-validation contracts as other participants. Both participant slots must work.

Implement legal fleet setup, readiness, legal unique targets, hit follow-up, and autonomous completion. Map existing difficulty levels to meaningful strategies, using known outcomes and remaining ship lengths as appropriate. Do not add an external AI service.

**A bot strategy must not receive or capture the opponent's canonical fleet.** Keep private opponent state out of its input, closures, caches, and helpers, not merely unused by convention.

Separate deterministic strategy tests from bounded empirical strength checks. Do not introduce a flaky requirement that a stronger bot wins every particular seeded match.

Cover stale suggestions, invalid decisions, cancellation, timeout where applicable, reconnect, and cleanup. Work started before a terminal state or rematch must not mutate the next state or game. Bot failures must not corrupt a match or degrade unrelated rooms.

## 9. Share the specifications and tests as aggressively as the production framework

**Battleship is a parameter of shared game specifications. It must not become another owner of copied platform behavior.**

Classify every required behavior by its true owner:

| Owner | What belongs there |
|---|---|
| Shared game framework or existing shared capability | Registration, navigation, custom games, matchmaking, participant orchestration, generic setup/readiness semantics, multiplayer, authorization boundaries, recovery, lifecycle finality, history, replay, bots, and shared screen behavior |
| Shared private-information capability | Authorized projections, recipient isolation, private transport, role-aware reconnect/history/replay, bot observation boundaries, and noninterference |
| Existing product-policy context | Identity, entitlements, space roles, access decisions, limits, and existing lifecycle policy |
| Battleship plugin | Fleet composition and geometry, placement legality, firing, hit/miss/sinking/victory rules, Battleship-specific observations, board input and presentation, and strategy |

Use the repository's actual ownership conventions; these are responsibilities, not a mandate to create a new package for every row.

Keep one canonical Gherkin source for each shared behavioral guarantee and execute it against compatible games through parameterized bindings. Do not duplicate feature files per game, generate committed copies, or conceal game-specific workflows behind generic step names.

Apply the same principle to contract tests, properties, model bindings, integration tests, and browser journeys. Use Gherkin, Quint, decision tables, structural specifications, and objectives according to existing conventions, not as a requirement to represent every rule in every language.

Battleship supplies minimal typed domain examples, actions, and independent expectations. The shared harness owns creating worlds, participants, spaces, network faults, clocks, workflow orchestration, assertions, evidence, and cleanup.

Do not replace duplicated tests with hundreds of lines of per-game fixture orchestration. Do not make fixtures decide their own pass/fail verdict or obtain all expected results from the implementation being tested.

Promote newly discovered reusable defects into shared regression coverage with preserved identifiers and reproducible seeds/traces. Keep genuinely Battleship-specific rule tests in Battleship. Preserve existing Chess-specific rule and puzzle coverage.

## 10. Enroll Battleship automatically in the conformance matrix

Use the authoritative registry and capability declarations to select applicable suites. Cross-check separate harness bindings against the shipped registry so omissions fail.

The confirmed feature matrix is:

| Experience | Chess | Connect Four | Battleship |
|---|---|---|---|
| Core registration and shared game experience | Required | Required | Required |
| Custom games | Required | Required | Required |
| Matchmaking | Required | Required | Required |
| Puzzles | Required | Not applicable | Not applicable |
| Private fleets and Battleship rules | Not applicable | Not applicable | Required |

For bots, history, replay, clocks, spectating, offline behavior, and other capabilities, inspect existing declarations and product requirements. The Battleship capabilities mandated by Appendix A remain required; optional capabilities remain conditional.

A private-information suite must be game-independent even if Battleship is its first production consumer. Use a small test-only consumer where needed to prove the abstraction without shipping another game.

Use meaningful matrix dimensions such as game, capability, phase, actor role, participant combination, network condition, and supported driver. Share test source, but keep independent results and evidence for each execution.

Required cases must not silently disappear because a fixture is missing, a selector filters them out, or a capability was removed to make the build green. Distinguish unsupported from missing, failed, stale, and unexecuted coverage.

Keep PR checks bounded and deterministic and nightly checks deeper through existing profiles. Do not blindly multiply every possible combination or recreate separate nightly-only behavior suites.

## 11. Prove correctness at the actual trust boundaries

Implement all mandatory scenarios and properties in Appendix A. In addition, use these framework-validation probes to make the source's guarantees concrete:

### Shared lifecycle and concurrency

Exercise independent simultaneous placement, readiness/unready/start races where supported, duplicate deliveries, fresh repeated targets, stale versions, out-of-turn commands, winning-shot races, termination, interrupted operations, every relevant reconnect phase, and rematch cleanup.

Verify that public outcomes converge while private views remain correctly different. Do not assert that private-information clients hold identical complete state.

### Privacy and noninterference

Construct different valid canonical fleets with identical authorized observations for a viewer. Their ordinary visible outputs must remain indistinguishable until a permitted action reveals a difference. After a shot, its legitimately different hit/miss result is allowed; unrelated information is not.

Test real APIs, fanout, snapshots, catch-up, cached observations, errors, telemetry capture, and replay authorization. Include a watching creator, opponent, participant, spectator where supported, and unauthorized requester as appropriate.

With identical authorized bot observations and controlled randomness, changing only the hidden opposing fleet must not change the bot decision.

### History and replay

Test server-side reconstruction separately from recipient-visible replay. Preserve action order, accepted outcomes, sinking, final results, authorization, incomplete-match privacy, nonmutating playback, and historical compatibility. Seeking a replay step or requesting another perspective must not grant access.

### Independent game-rule expectations

Use the specified fleet sizes and independently constructed positions to verify placement, damage, sinking, victory, and permitted symmetry transformations. Do not prove shot correctness by calling the same resolver twice.

### Tests that can detect defects

Use bounded, test-only faulty implementations or equivalent fault injection for the contracts touched by this work. Demonstrate detection of a leaked private field, duplicate logical completion, invalid phase transition, or missing mandatory matrix binding as appropriate.

The meta-test passes only when the expected defect is detected for the intended reason. Do not contaminate production code, weaken assertions, or build a new mutation-testing platform for this task.

### Complete journeys and regression protection

Drive actual custom human/human, human/bot, bot/human, bot/bot, matchmaking-to-setup-to-completion, reconnect, and authorized history/replay paths through existing harnesses and the required real-browser release journeys.

Run relevant shared suites for Chess and Connect Four after shared changes. Chess's puzzle experience must remain intact; Connect Four must not acquire puzzle stubs. Preserve the framework's ability to build and test without importing production games.

## 12. Preserve observability, operational safety, and performance

Integrate with existing telemetry and health infrastructure. Observe lifecycle, readiness, combat progress, result handling, stalls, bot failures, validation failures, and recovery without logging hidden fleets or secrets.

Use existing dedicated synthetic identities, isolated test worlds, cleanup, and allowed environment commands. Do not use real players' data or perform unauthorized deployments, destructive infrastructure changes, account changes, or real financial operations.

Prove private-state non-disclosure primarily in deterministic security and integration tests; keep live health probes safe, bounded, privacy-preserving, and useful for detecting operational failures.

Honor existing deterministic I/O, serialization, sync/room separation, resource ownership, package boundaries, and performance requirements. Do not make unrelated games slower or less reliable to support Battleship.

## 13. Execute in this order

1. **Discover:** Read the actual framework, integrations, specs, and tooling. Build the requirement-to-owner checklist and identify genuine gaps.
2. **Specify:** Add or extend canonical shared specifications and Battleship-only rule specs. Preserve the repository's required spec-first change and commit discipline.
3. **Extend only when necessary:** Implement the smallest reusable contracts needed for private views, setup phases, or other demonstrated gaps, with shared tests. Do not rewrite unrelated APIs.
4. **Implement the plugin:** Build deterministic rules, participant projections, board interactions, bot strategy, and required domain fixtures using public contracts.
5. **Integrate:** Wire all required shared workflows, navigation, permissions, persistence, history, replay, telemetry, and safe health coverage.
6. **Verify incrementally:** Run focused package checks while working; resolve rule, integration, privacy, and lifecycle defects.
7. **Validate the whole product:** Run the repository's required PR gate, expected to be `bun check-pr`, and relevant comprehensive groups through its existing nightly tooling, expected to be `bun check-nightly`. Use the actual current scripts and existing CI routing.
8. **Clean up:** Delete obsolete scaffolding, duplicate paths, dead code, and temporary bypasses. Refresh generated catalogs and relevant documentation.
9. **Report:** Provide concrete evidence against the checklist, not a declaration based on code inspection alone.

Use the current branch/worktree and the repository's authorized commit workflow. Do not merge, force-push, create additional worktrees, or deploy without the required authorization.

Do not relax checks, skip tests, introduce retries to conceal failures, lower existing quality gates, or remove required capabilities to obtain a pass. Run the applicable verification for the final changes, not merely an earlier revision.

If credentials, hardware, external services, or an unresolved specification conflict genuinely prevent verification, finish all safe unblocked work and report the exact blocker and unmet acceptance criteria. Distinguish implemented, verified, failed, and not run. Never label incomplete evidence as production readiness.

## 14. Completion criteria and final report

Complete the task only when Appendix A's definition of done and the framework requirements above are satisfied.

The decisive outcomes are:

- Battleship is discoverable and fully playable through shared custom games and matchmaking.
- Every required human/bot combination works, with autonomous fair bots.
- Classic setup and combat rules are correct, deterministic, and independently tested.
- Hidden fleets are protected throughout setup, combat, reconnect, termination, history, replay, and operational surfaces under the specified policy.
- Shared framework behavior and screen changes propagate to all applicable games without copied implementations.
- Required framework specifications and tests run automatically for Battleship; existing games retain their applicable matrix coverage and behavior.
- Battleship adds unique mechanics and presentation rather than duplicated application infrastructure.
- Necessary framework changes are reusable, game-independent, tested, and proportionate.
- All mandatory requirements have traceable verification, with no placeholder or manual workaround replacing required behavior.

Finish with a concise report containing:

1. What is implemented and the supported capability/mode matrix.
2. Framework behavior reused versus genuinely Battleship-specific code.
3. Every shared framework/API change, why it was necessary, and how existing games were protected.
4. Shared specifications/tests extended, automatic matrix enrollment, and Battleship-specific rule coverage.
5. Requirement traceability for all `BS-*`, `P-*`, and mandatory scenario groups, including justified conditional applicability.
6. Privacy, replay, bot-fairness, concurrency, and negative-test evidence.
7. Commands run, outcomes, and existing evidence locations; distinguish failures and unexecuted checks.
8. Any remaining blocker, limitation, or unmet requirement.

**Do not declare completion merely because Battleship works in isolation. The result must be a complete game that demonstrates the framework's leverage: opinionated shared experiences, isolated plugins, reusable specifications, automatically inherited edge cases, and rigorous recipient-specific privacy.**

---

# Appendix A — Complete Supplied Battleship Specification

The following specification is included verbatim to preserve every requirement, scenario, property, and scope boundary. Apply the explicit current-catalog clarification in section 1 above to its historical references to other games. Do not interpret the appendix as a request to duplicate shared specifications into Battleship-owned files; implement each requirement under its proper owner and retain traceability.

# Battleship Game Specification

**Status:** Implementation specification  
**Game:** Battleship  
**Type:** Two-player, turn-based, hidden-information strategy game  
**Ruleset:** Classic 10×10 Battleship, alternating single shots  
**Integration:** Sibling to Chess, Quoridor, Connect Four, and Tic-Tac-Toe  
**Platform reference:** Existing product architecture and executable specifications

---

## 1. Product principles

### BS-001 — First-class game

Battleship SHALL integrate through the same game registration and discovery systems as existing games.

### BS-002 — Shared infrastructure

All applicable custom-game, multiplayer, matchmaking, bot, lifecycle, history, permission, and UX capabilities SHALL reuse established platform functionality.

### BS-003 — Game-independent rules

Game rules SHALL be deterministic and verifiable independently from network transport and user presentation.

### BS-004 — Hidden information

The system SHALL distinguish canonical hidden game state from each participant's authorized view.

### BS-005 — Authoritative fairness

All gameplay decisions SHALL be validated against canonical state, without trusting a client to report whether its own fleet has been hit.

### BS-006 — Historical stability

Persisted games SHALL remain interpretable under their original ruleset and visibility policies.

---

## 2. Board and fleet

### BS-010 — Board dimensions

Each player SHALL have one 10×10 board containing 100 cells.

### BS-011 — Players

Each match SHALL have exactly two playing participants.

### BS-012 — Fleet composition

Each player SHALL have exactly five ships:

| Ship | Length | Quantity |
|---|---:|---:|
| Carrier | 5 | 1 |
| Battleship | 4 | 1 |
| Cruiser | 3 | 1 |
| Submarine | 3 | 1 |
| Destroyer | 2 | 1 |

Each fleet occupies exactly 17 cells.

### BS-013 — Ship geometry

Every ship SHALL occupy a straight, contiguous sequence of cells arranged horizontally or vertically.

### BS-014 — Boundaries

Ships SHALL be entirely contained within the board.

### BS-015 — No overlapping

Two ships SHALL NOT occupy the same cell.

### BS-016 — Adjacency

Ships MAY occupy adjacent cells, including orthogonal and diagonal adjacency, provided they do not overlap.

### BS-017 — No movement after readiness

Once fleet placement is finalized and gameplay begins, ships SHALL NOT move, rotate, or change position.

### BS-018 — Fleet completeness

A player SHALL NOT enter the ready state with missing, duplicate, or invalid ships.

### BS-019 — Fleet identity

Every ship SHALL have an identity and length, even when multiple ships share the same length.

### BS-020 — Fleet independence

The players' boards and ship placements SHALL be logically independent.

---

## 3. Setup and readiness

### BS-030 — Setup phase

Each match SHALL begin with a setup phase in which players place their fleets.

### BS-031 — Private placement

Each participant SHALL only see their own unrevealed fleet during ordinary setup.

### BS-032 — Independent preparation

Both participants MAY prepare their fleets independently without taking alternating setup turns.

### BS-033 — Manual placement

Players SHALL be able to select, position, and orient ships.

### BS-034 — Rotation

Ships SHALL support horizontal and vertical orientations.

### BS-035 — Invalid placement

Overlapping or out-of-bounds placements SHALL be rejected without corrupting the current valid configuration.

### BS-036 — Editing

Players MAY modify their own fleet before confirming readiness.

### BS-037 — Random placement

Players SHALL be able to generate a complete, valid random fleet.

### BS-038 — Randomization correctness

Every automatically generated fleet SHALL satisfy all placement rules.

### BS-039 — Readiness

Players SHALL explicitly indicate when their fleet configuration is complete, except where the existing game mode appropriately automates bot or participant readiness.

### BS-040 — Readiness validation

A player SHALL NOT become ready without a valid complete fleet.

### BS-041 — Placement locking

A confirmed fleet SHALL be immutable while readiness remains committed and after gameplay starts.

### BS-042 — Unready behavior

If the platform supports withdrawing readiness before game start, doing so MAY unlock that player's placement for further editing.

It SHALL NOT expose the player's fleet to the opponent.

### BS-043 — Game start

Combat SHALL begin only when both participants are ready and all required session conditions are satisfied.

### BS-044 — First shooter

Exactly one participant SHALL be assigned the first shot according to existing game configuration or matchmaking policy.

### BS-045 — Setup privacy

Opponent readiness MAY be public, but exact ship placement SHALL remain private.

### BS-046 — Setup interruption

Disconnects, canceled sessions, and reconnections SHALL follow existing game lifecycle policies without revealing fleet information.

---

## 4. Turns and firing

### BS-050 — Alternating turns

Participants SHALL alternate turns after each accepted nonterminal shot.

### BS-051 — One shot

Each ordinary turn SHALL contain exactly one accepted shot.

### BS-052 — Opponent targeting

A shot SHALL target exactly one cell on the opponent's board.

### BS-053 — Valid target

A valid shot SHALL select an in-bounds cell that has not already been targeted by the same attacking player in that match.

### BS-054 — Repeated shots

A previously targeted cell SHALL NOT be a legal new shot.

### BS-055 — Bounds

A shot outside the opponent's board SHALL be rejected.

### BS-056 — Active participant

Only the active participant SHALL submit gameplay shots.

### BS-057 — Atomic resolution

Shot acceptance, hit/miss determination, applicable ship sinking, victory detection, and turn progression SHALL be logically atomic.

### BS-058 — Invalid action

Rejected shots SHALL NOT change the board, consume a turn, or create an accepted shot-history entry.

### BS-059 — No bonus turn

A successful hit SHALL NOT grant another turn under this ruleset.

### BS-060 — No passing

Players SHALL NOT pass an ordinary combat turn.

### BS-061 — Terminal restriction

No combat actions SHALL be accepted after the match reaches a terminal state.

---

## 5. Hits, misses, and sinking

### BS-070 — Hit

A shot targeting an occupied ship cell SHALL be resolved as a hit.

### BS-071 — Miss

A shot targeting a cell containing no ship SHALL be resolved as a miss.

### BS-072 — Unique targeting

Each cell SHALL have at most one accepted shot result per attacking player in a match.

### BS-073 — Hit persistence

Hits SHALL remain recorded for the duration of the match.

### BS-074 — Miss persistence

Misses SHALL remain recorded for the duration of the match.

### BS-075 — Ship sinking

A ship SHALL be considered sunk when every cell belonging to that ship has been hit.

### BS-076 — Partial damage

A ship with fewer hits than its length SHALL remain afloat.

### BS-077 — Sinking event

When a shot sinks a ship, its resolution SHALL communicate the sinking event to authorized participants.

### BS-078 — Sunk ship identity

The sunk ship's identity SHALL be made available as part of the public combat result, consistent with the selected classic ruleset.

### BS-079 — Unrevealed cells

An attack SHALL NOT disclose unrelated cells containing ships.

### BS-080 — Monotonic damage

Accepted hits and misses SHALL not be undone during ordinary gameplay.

### BS-081 — Fleet status

Own-fleet damage and publicly known opponent damage SHALL be represented consistently.

### BS-082 — Shot-result consistency

Both participants SHALL agree on the outcome of every accepted shot.

---

## 6. Victory and termination

### BS-090 — Victory condition

A player SHALL win immediately when all 17 cells of the opponent's fleet have been hit.

### BS-091 — Fleet destruction

Victory SHALL coincide with the sinking of the opponent's fifth and final remaining ship.

### BS-092 — Immediate completion

The match SHALL end as part of the accepted winning shot.

### BS-093 — No standard draw

Classic Battleship SHALL NOT ordinarily produce a draw through board play.

### BS-094 — Resignation

Resignation SHALL follow existing product lifecycle policies and produce the appropriate opponent victory.

### BS-095 — Timeout

Where enabled, time controls SHALL follow platform policy.

### BS-096 — Abandonment

Disconnection, abandonment, and forfeiture SHALL follow the existing session policy.

### BS-097 — Cancellation

Matches canceled before competitive gameplay SHALL be distinguishable from completed games.

### BS-098 — Final result

Every terminal match SHALL have one consistent result and termination reason.

### BS-099 — Terminal finality

No further gameplay actions SHALL be accepted after completion.

---

## 7. Hidden-information visibility and security

### BS-100 — Canonical hidden state

The canonical game state SHALL contain the information required to validate both fleets and resolve shots.

### BS-101 — Owner visibility

A player SHALL be authorized to view their own fleet positions and damage state.

### BS-102 — Opponent secrecy

A player SHALL NOT receive the opponent's unrevealed ship locations during an active match.

### BS-103 — Progressive disclosure

An opponent's board SHALL reveal information only through accepted gameplay actions and the explicit rules of the game.

### BS-104 — Public shots

Accepted shot coordinates and outcomes SHALL be visible to the participating players.

### BS-105 — Placement confidentiality

Fleet placement, rotation, randomization, and editing SHALL not generate opponent-visible position data.

### BS-106 — Role-specific state

Every participant SHALL receive a state representation appropriate to their identity and permissions.

### BS-107 — Spectators

Spectator access, where supported, SHALL NOT disclose either player's hidden fleet information unless an explicit authorized spectator policy permits such disclosure.

### BS-108 — Unauthorized access

An unauthorized user SHALL NOT be able to retrieve private fleet state through direct API calls, real-time subscriptions, room joining, history access, or replay.

### BS-109 — No UI-only secrecy

Private information SHALL not be hidden merely through CSS, component visibility, client-side filtering of a complete state, or another presentation-only mechanism.

### BS-110 — Error privacy

Validation errors SHALL NOT inadvertently reveal hidden ship positions.

### BS-111 — Telemetry privacy

Logs, diagnostics, traces, and health-check outputs SHALL avoid leaking unrevealed fleet configurations into unintended observability surfaces.

### BS-112 — Reconnection privacy

Reconnecting participants SHALL receive only the hidden state they are authorized to view.

### BS-113 — Bot information

Bots SHALL make gameplay decisions using only the information available to their participant role.

### BS-114 — Historical privacy

Completed and incomplete matches SHALL follow an explicit, consistent visibility policy.

### BS-115 — Post-match disclosure

The initial standard policy SHALL preserve opponent fleet secrecy after match completion, apart from information legitimately revealed during play. Any optional full-fleet reveal or omniscient replay SHALL require an explicit product policy, appropriate participant consent or authorization, and separate verification.

### BS-116 — Information-flow noninterference

For any two valid canonical states that produce the same authorized observation for a participant, that participant's ordinary view SHALL be indistinguishable until a permitted game action or disclosure reveals additional information.

### BS-117 — Serialization safety

Transported state and events SHALL exclude information a recipient is not authorized to know.

### BS-118 — Administrative access

Any privileged operational access to hidden fleet state SHALL be governed by the existing platform's administrative authorization and privacy controls.

---

## 8. Custom games

### BS-120 — Creation

Battleship SHALL be available through the existing custom-game creation experience.

### BS-121 — Human versus human

Custom games SHALL support two human participants.

### BS-122 — Human versus bot

Custom games SHALL support humans playing against bots in either participant slot.

### BS-123 — Bot versus bot

Custom games SHALL support two bot participants.

### BS-124 — Local gameplay

Local multiplayer MAY be supported where the platform can provide an understandable privacy-preserving handoff between players.

A shared-screen local game SHALL NOT inadvertently reveal hidden fleets.

### BS-125 — Remote gameplay

Custom games SHALL support remote multiplayer through existing rooms.

### BS-126 — Private games

Invitations, privacy, joining, and participant assignment SHALL follow established product behavior.

### BS-127 — Configuration

Applicable first-turn assignment, bot difficulty, clocks, and participant settings SHALL reuse existing configuration patterns.

### BS-128 — Readiness lifecycle

Custom games SHALL handle setup readiness distinctly from combat turns.

### BS-129 — Rematches

Rematches SHALL support fresh fleet setup and appropriate participant reassignment.

### BS-130 — Independent matches

Each new game and rematch SHALL have an independent state, lifecycle, and historical record.

### BS-131 — Configuration validation

Invalid participant and session configurations SHALL be rejected before gameplay.

---

## 9. Multiplayer and real-time rooms

### BS-140 — Shared infrastructure

Battleship SHALL use existing product real-time room and space systems.

### BS-141 — Room lifecycle

Hosting, joining, invitations, readiness, presence, leaving, and closure SHALL follow shared conventions.

### BS-142 — Private synchronization

Each player SHALL receive authorized updates for their own setup state and fleet.

### BS-143 — Public synchronization

Both players SHALL converge on accepted combat results, current turn, game phase, and match outcome.

### BS-144 — Simultaneous setup

Both participants SHALL be able to prepare independently without unintentionally overwriting each other's setup state.

### BS-145 — Simultaneous actions

Conflicting combat actions SHALL be resolved deterministically.

### BS-146 — Duplicate actions

Repeated action delivery SHALL NOT cause multiple shots or other duplicated state changes.

### BS-147 — Stale actions

Actions based on obsolete match versions SHALL NOT overwrite more recent canonical state.

### BS-148 — Reconnection

Reconnect SHALL restore a participant's authorized private state together with the appropriate public match state.

### BS-149 — Out-of-order events

Event reordering SHALL NOT result in permanent divergence or unauthorized disclosure.

### BS-150 — Authorization

Gameplay and setup actions SHALL be accepted only from the appropriate participant.

### BS-151 — Room closure

Room closure SHALL apply the existing persistence and termination policies.

### BS-152 — Recovery

Interrupted or rejected operations SHALL not create inconsistent ship placement, shot history, or turn ownership.

### BS-153 — Presence

Presence changes SHALL not count as gameplay actions.

### BS-154 — Information isolation

Private updates intended for one participant SHALL NOT be delivered to the opposing participant or unauthorized observers.

---

## 10. Matchmaking

### BS-160 — Discovery

Battleship SHALL be selectable through existing matchmaking.

### BS-161 — Queue identity

Matchmaking requests SHALL identify Battleship and applicable queue constraints.

### BS-162 — Compatible pairing

Only compatible participants SHALL be paired.

### BS-163 — Game separation

Battleship requests SHALL not be paired with Chess, Quoridor, Connect Four, or Tic-Tac-Toe requests.

### BS-164 — Match initialization

Successful assignment SHALL create an appropriate session and room in the fleet-setup phase.

### BS-165 — First-turn assignment

The first shooter SHALL be assigned consistently and fairly according to existing policies.

### BS-166 — Queue cancellation

Canceling a search SHALL follow established queue lifecycle behavior.

### BS-167 — Race safety

Cancellation, duplicate requests, and concurrent assignments SHALL not create unintended duplicate matches.

### BS-168 — Ready checks

Existing match acceptance and connection readiness conventions SHALL apply where supported.

### BS-169 — Bot fallback

Supported matchmaking bot fallback SHALL reuse established eligibility, behavior, and disclosure policies.

### BS-170 — Failure handling

Matchmaking failures SHALL produce recoverable outcomes.

### BS-171 — Ratings

Where competitive ratings exist, Battleship results SHALL be associated with the appropriate game-specific ranking model.

---

## 11. Bots

### BS-180 — Shared participants

Bots SHALL use the existing game participant and session lifecycle contracts.

### BS-181 — Legal fleets

Bots SHALL generate valid complete fleet placements.

### BS-182 — Readiness

Bots SHALL complete setup and readiness without requiring human intervention.

### BS-183 — Legal targeting

Bots SHALL target only valid previously untargeted cells.

### BS-184 — Hidden-information fairness

Bots SHALL not access the opposing player's unrevealed ship placements.

### BS-185 — Information memory

Bots MAY reason using their own accepted shot history, known misses, hits, sunk ships, and remaining fleet composition.

### BS-186 — Meaningful difficulty

Existing difficulty levels SHALL map to distinguishable playing strengths.

### BS-187 — Basic behavior

Lower difficulties MAY use simple legal targeting strategies.

### BS-188 — Advanced behavior

Stronger difficulties SHOULD demonstrate intelligent searching, hit follow-up, ship-length reasoning, and probability-informed targeting.

### BS-189 — Bot versus bot

Two bots SHALL be capable of completing setup and combat autonomously through a terminal result.

### BS-190 — Turn compliance

Bots SHALL act only when authorized for the current game phase and turn.

### BS-191 — Failure recovery

Bot errors, invalid suggestions, or execution failures SHALL not corrupt game state.

### BS-192 — Reproducibility

Deterministic testing facilities SHALL allow bot decisions and fleet generation to be reproduced where applicable.

### BS-193 — Resource safety

Bot computation SHALL not degrade unrelated rooms.

### BS-194 — Cleanup

Bot activity SHALL stop after game termination or session disposal.

---

## 12. History and replay

### BS-200 — Durable records

Matches eligible for persistence SHALL use the existing product history system.

### BS-201 — Recorded information

A historical record SHALL contain enough authorized information to identify the match, participants, ruleset/version, configuration, accepted actions, and result.

### BS-202 — Setup records

Fleet placement SHALL be retained where required for correct reconstruction, auditing, or playback, with appropriate access restrictions.

### BS-203 — Shot history

Every accepted combat shot SHALL appear in chronological order with its resolved outcome.

### BS-204 — Sinking events

Replay SHALL reconstruct ship damage and sinking correctly.

### BS-205 — Deterministic reconstruction

A match SHALL be reconstructible from its valid initial state, finalized fleet configurations, and ordered accepted actions.

### BS-206 — Role-aware replay

Replay SHALL display only information authorized by the applicable history visibility policy.

### BS-207 — No private information leakage

A replay viewer SHALL not obtain hidden fleet information merely by requesting a different replay step, participant identity, or serialized history representation.

### BS-208 — Incomplete matches

Canceled, abandoned, or interrupted matches SHALL maintain appropriate history semantics and confidentiality.

### BS-209 — Nonmutating replay

Replaying a match SHALL not alter historical or active gameplay state.

### BS-210 — History discovery

Battleship SHALL appear in applicable history views, search/filter controls, and profile surfaces.

### BS-211 — Statistics

Applicable games played, wins, losses, and other relevant game statistics SHALL be recorded separately from unrelated games.

### BS-212 — Historical compatibility

Existing matches SHALL remain interpretable under subsequent compatible product versions.

### BS-213 — Access control

History and replay authorization SHALL follow shared platform permissions together with Battleship's hidden-information policy.

---

## 13. User experience

### BS-220 — Shared layout

Battleship SHALL reuse the product's game screen architecture, navigation, player panels, controls, and result presentation.

### BS-221 — Setup interface

Fleet placement SHALL be intuitive, with clear ship selection, positioning, rotation, and placement feedback.

### BS-222 — Placement preview

Candidate ship placements SHOULD show their intended occupied cells and validity before confirmation.

### BS-223 — Random placement

Players SHALL have a discoverable way to generate a legal random fleet.

### BS-224 — Readiness feedback

Players SHALL clearly understand whether their fleet is complete and whether they have confirmed readiness.

### BS-225 — Opponent readiness

The opponent's readiness status SHALL be communicated without exposing hidden placement details.

### BS-226 — Battle boards

Gameplay SHALL clearly distinguish the player's own fleet board from their targeting board.

### BS-227 — Targeting

Available targets SHALL be easy to identify and select.

### BS-228 — Shot history

Known hits, misses, and sunk ships SHALL be visually distinguishable.

### BS-229 — Last action

The opponent's most recent attack SHOULD be easy to locate.

### BS-230 — Turn indication

The active player SHALL be unmistakably identified.

### BS-231 — Fleet information

The UI SHALL distinguish the player's complete own-fleet knowledge from public information about the opponent.

### BS-232 — Shot animations

Attacks, hits, misses, and sinking events MAY use polished animations that do not alter canonical state.

### BS-233 — Terminal presentation

Victory, defeat, resignation, timeout, and other applicable results SHALL use existing product result patterns.

### BS-234 — Responsive design

Gameplay SHALL remain practical on supported mobile, tablet, and desktop layouts.

### BS-235 — Mobile boards

On smaller screens, users SHALL be able to switch or otherwise navigate between fleet and targeting views without losing important context.

### BS-236 — Touch accessibility

Ship placement and targeting SHALL not require impractically precise touch interactions.

### BS-237 — Keyboard accessibility

Ship positioning, rotation, targeting, and confirmation SHALL have accessible keyboard interaction paths.

### BS-238 — Screen readers

Boards, ship states, public attack outcomes, current turns, and applicable controls SHALL have meaningful accessible semantics.

### BS-239 — Reduced motion

The game SHALL remain fully playable when animations are reduced or disabled.

### BS-240 — Reconnection UX

A reconnecting player SHALL see an accurate restored setup or combat phase.

### BS-241 — Pending actions

Pending and rejected actions SHALL not create permanently misleading visual state.

### BS-242 — Help and onboarding

Instructions SHALL explain placement, ship composition, firing, hits, misses, sinking, and victory.

### BS-243 — Privacy-aware local play

Where local human-vs-human play is offered on a shared device, the experience SHALL provide a deliberate handoff that does not reveal one player's fleet to the other unintentionally.

### BS-244 — Replay presentation

Replay SHALL clearly distinguish historical information from currently active gameplay.

---

## 14. Authorization and entitlements

### BS-250 — Shared authorization

Battleship SHALL use existing declarative permission mechanisms.

### BS-251 — Participant control

Only the authorized participant SHALL control their fleet or submit a shot on their turn.

### BS-252 — Guest policy

Guest access SHALL follow existing platform capabilities.

### BS-253 — Membership policy

Custom games, multiplayer, matchmaking, bots, and history SHALL respect applicable entitlements.

### BS-254 — Private sessions

Private games SHALL enforce established invitation and membership rules.

### BS-255 — Private state permissions

Viewing hidden fleet information SHALL require the appropriate participant or explicitly privileged authorization.

### BS-256 — Denied operations

Unauthorized operations SHALL produce the platform's normal error and permission UX without disclosing private game state.

---

## 15. Clocks and lifecycle

### BS-260 — Time controls

Applicable game clocks SHALL reuse existing platform capabilities.

### BS-261 — Phase-aware timing

Combat clocks and any setup deadlines SHALL follow explicit platform policies appropriate to those phases.

### BS-262 — Clock ownership

Combat clock transitions SHALL correspond to accepted canonical turn transitions.

### BS-263 — Timeout consistency

Time expiration SHALL produce one authoritative result.

### BS-264 — Reconnection timing

Reconnection SHALL not incorrectly reset clocks or extend deadlines.

### BS-265 — Untimed games

Untimed sessions SHALL remain supported where existing platform policy allows.

### BS-266 — Session termination

Resignation, cancellation, abandonment, and room closure SHALL follow shared lifecycle conventions.

---

## 16. Observability and health

### BS-270 — Shared telemetry

Battleship SHALL use the product's existing observability systems.

### BS-271 — Lifecycle visibility

Setup, readiness, combat starts, shots, results, completion, and failures SHALL be observable.

### BS-272 — Matchmaking health

Existing matchmaking health coverage SHALL include Battleship.

### BS-273 — Multiplayer health

Multiplayer health checks SHALL validate Battleship session synchronization and recovery.

### BS-274 — Bot health

Incomplete bot setup, invalid targeting, stalled turns, and bot failures SHALL be detectable.

### BS-275 — Integrity failures

Invalid placements, inconsistent shot histories, incorrect sinking results, and state divergence SHALL be detectable.

### BS-276 — Privacy checks

Automated health and security tests SHALL validate the absence of unauthorized private-state disclosure.

### BS-277 — Operational reuse

Deployment, configuration, monitoring, and delivery SHALL follow existing platform infrastructure.

### BS-278 — Resource isolation

Battleship workloads SHALL not disrupt unrelated games.

### BS-279 — Telemetry minimization

Sensitive fleet information SHALL not be unnecessarily included in operational telemetry.

---

## 17. Mandatory executable scenarios

### Fleet setup

- Initialize two independent 10×10 boards.
- Place each of the five standard ships.
- Place ships horizontally.
- Place ships vertically.
- Rotate ships before readiness.
- Reject placements beyond every board edge.
- Reject overlapping ships.
- Permit adjacent ships.
- Permit diagonal ship adjacency.
- Reject incomplete fleets at readiness.
- Generate valid random fleets repeatedly.
- Edit placement before readiness.
- Lock placement after readiness.
- Prevent opponent observation of setup.
- Start combat only after both players are ready.

### Combat

- Fire at an empty cell and produce a miss.
- Fire at an occupied cell and produce a hit.
- Record shots on both relevant player views.
- Reject shots outside the board.
- Reject previously targeted cells.
- Reject attacks from the inactive player.
- Alternate turns after hits.
- Alternate turns after misses.
- Sink a ship on its final remaining cell.
- Keep partially damaged ships afloat.
- Sink ships of every supported length.
- Win by sinking the final remaining ship.
- Reject shots following victory.
- Reject invalid actions without state changes.

### Hidden information

- A player sees their own fleet.
- A player cannot see opponent unrevealed ships.
- Private setup messages are never delivered to opponents.
- An accepted miss reveals no unrelated ship positions.
- An accepted hit reveals only the permitted result.
- A sinking event reveals the permitted ship identity without leaking unrelated fleet positions.
- Reconnection does not reveal private opponent state.
- Spectator state contains only authorized information.
- Direct API requests cannot bypass participant visibility.
- Invalid-action errors do not reveal hidden information.
- Replay does not reveal unauthorized fleets.
- Bot decisions cannot access opposing unrevealed ships.
- Logging and telemetry avoid unintended hidden-information disclosure.

### Custom games and bots

- Human-vs-human remote game.
- Human-vs-bot game.
- Bot-vs-human game.
- Bot-vs-bot game.
- Bot completes fleet setup.
- Bot confirms readiness.
- Bot selects legal shots.
- Bot never targets the same cell twice.
- Bot correctly recognizes known sinking outcomes.
- Stronger bots demonstrate meaningful strategy.
- Bot-vs-bot games terminate automatically.
- Bot errors do not corrupt the match.
- Rematches create new independent fleet setups.

### Multiplayer

- Two remote participants join one room.
- Both participants complete private setup.
- Both observe the correct public readiness states.
- Combat starts only when appropriate.
- Shots synchronize correctly.
- Concurrent requests cannot consume a turn twice.
- Duplicate shots do not create extra turns.
- Stale actions cannot overwrite valid state.
- Out-of-order events recover correctly.
- Reconnecting players recover authorized state.
- Unauthorized participants cannot control gameplay.
- Room termination preserves correct result and privacy.

### Matchmaking

- User selects Battleship matchmaking.
- Two compatible players are paired.
- Queues remain isolated from other games.
- Assignment creates a fleet-setup session.
- Cancellation works.
- Duplicate requests are handled safely.
- Assignment races are resolved.
- Applicable bot fallback works.
- Failed matchmaking produces recoverable behavior.

### History and replay

- Completed matches appear in history.
- Shot history preserves correct action ordering.
- Replay reconstructs hit/miss results.
- Replay reconstructs sinking events.
- Replay reconstructs final fleet destruction.
- Replay maintains viewer-specific privacy.
- Incomplete games preserve hidden information.
- History access follows permissions.
- Replay does not modify the original game.
- Statistics reflect correct results.
- Historical matches remain interpretable after compatible updates.

### UX and accessibility

- Ship placement is understandable.
- Rotation and invalid positions are clear.
- Random placement is available.
- Readiness is unmistakable.
- Target selection is practical on mobile.
- Own fleet and target boards are distinguishable.
- Hits, misses, and sinking are identifiable without color alone.
- Turn state and opponent's last attack are clear.
- Screen-reader descriptions are useful.
- Keyboard controls support setup and combat.
- Reduced-motion preferences are respected.
- Reconnection restores the correct visible state.
- Privacy-preserving local handoffs work where supported.

---

## 18. Property-based and model-based verification

**P-001 — Board bounds:** Every ship and shot lies within its applicable board.

**P-002 — Fleet completeness:** Every ready player owns exactly the specified five ships.

**P-003 — Fleet occupancy:** A complete fleet occupies exactly 17 distinct cells.

**P-004 — Ship contiguity:** Every ship occupies a straight, uninterrupted sequence.

**P-005 — Non-overlap:** Distinct ships never share occupied cells.

**P-006 — Placement immutability:** Finalized fleets remain unchanged during combat.

**P-007 — Shot uniqueness:** A player never commits more than one ordinary shot at the same opposing cell.

**P-008 — Turn alternation:** Accepted nonterminal shots alternate the active player.

**P-009 — Rejection immutability:** Invalid actions do not alter canonical gameplay state.

**P-010 — Hit correctness:** A hit corresponds to an occupied opposing ship cell.

**P-011 — Miss correctness:** A miss corresponds to an unoccupied opposing cell.

**P-012 — Sinking correctness:** A ship is sunk exactly when every occupied cell belonging to it has been hit.

**P-013 — Victory correctness:** Standard victory occurs exactly when the final opposing fleet cell is hit.

**P-014 — Terminal finality:** No gameplay action is accepted after terminal completion.

**P-015 — Damage monotonicity:** Hits and misses are never removed during ordinary combat.

**P-016 — Determinism:** Identical valid initial fleet placements and action sequences produce identical results.

**P-017 — Replay equivalence:** Reconstruction produces the same canonical state and shot outcomes.

**P-018 — Match isolation:** Actions in one match cannot modify another match.

**P-019 — Retry safety:** Duplicate delivery cannot consume extra turns or repeat shots.

**P-020 — Concurrency safety:** Concurrent actions cannot produce inconsistent shot histories.

**P-021 — Recovery equivalence:** Correct restoration reproduces the same match state.

**P-022 — Private-view correctness:** A participant's view contains only authorized information.

**P-023 — Noninterference:** Hidden opponent fleet configurations that are indistinguishable under known observations produce indistinguishable participant views until legitimate disclosure.

**P-024 — Bot fairness:** Bots cannot derive decisions from unrevealed opponent fleet positions.

**P-025 — Symmetry:** Consistent board transformations preserve fleet geometry, shot legality, and outcomes.

**P-026 — Readiness validity:** No match enters combat with an incomplete or invalid fleet.

**P-027 — Public-result consistency:** Both players agree on all accepted public shot outcomes.

**P-028 — Information monotonicity:** Legitimately revealed shot outcomes do not revert to unknown during a match.

**P-029 — Historical authorization:** Replay and history disclose no more than their applicable access policy permits.

**P-030 — Lifecycle integrity:** Setup, combat, and terminal transitions follow the defined game lifecycle.

### Generated verification requirements

Randomized and model-based tests SHALL explore:

- Many valid fleet layouts.
- Ship placements at every board edge and corner.
- Adjacent and nearly overlapping ships.
- Invalid placements.
- Random legal attack sequences.
- Full and nearly exhausted target grids.
- Hits that sink ships.
- Final winning shots.
- Conflicting concurrent actions.
- Interrupted setup and combat.
- Duplicate and out-of-order messages.
- Reconnection from every phase.
- Different private views of identical canonical matches.
- Adversarial attempts to retrieve hidden data.
- Bot-vs-bot matches under many deterministic seeds.

Failures SHALL be reproducible through the existing testing facilities.

---

## 19. Integration acceptance matrix

| Capability | Required outcome |
|---|---|
| Registration | Native Battleship game |
| Rules | Complete classic gameplay |
| Fleet placement | Manual and automatic |
| Hidden state | Secure participant-specific visibility |
| Custom games | Human/human, human/bot, bot/bot |
| Multiplayer | Existing rooms and real-time infrastructure |
| Matchmaking | Battleship-specific pairing |
| Bots | Legal setup and autonomous combat |
| Lifecycle | Setup, readiness, combat, completion |
| Recovery | Reconnection and action retry safety |
| History | Durable, privacy-aware records |
| Replay | Correct, role-aware reconstruction |
| Profiles | Applicable game statistics |
| Permissions | Existing declarative authorization |
| UI | Established product design conventions |
| Accessibility | Pointer, touch, keyboard, screen readers |
| Specifications | Executable behavior and invariants |
| Observability | Existing telemetry and health checks |
| Regression | All existing games preserved |

---

## 20. Scope boundaries

The initial implementation SHALL support classic two-player Battleship.

The following are not required unless existing platform capabilities or explicit product requirements demand them:

- Salvo mode.
- Bonus turns after hits.
- More than two players.
- Custom fleet sizes.
- Alternative board dimensions.
- Moving ships during combat.
- Special weapons or power-ups.
- Mines or additional vessel types.
- Arbitrary ruleset authoring.
- Tournament infrastructure not already available.
- Independent Battleship backend services.
- External AI inference for bot gameplay.
- Mandatory full-fleet disclosure after completion.

These exclusions SHALL NOT justify bypassing applicable shared product capabilities.

---

## 21. Definition of done

Battleship is complete only when:

1. Every classic placement, shot, sinking, and victory rule works correctly.
2. Fleet placement is private, validated, and immutable during combat.
3. Opponent hidden information cannot be retrieved through ordinary participant interfaces.
4. Every required custom human/bot combination works.
5. Multiplayer and matchmaking function end-to-end.
6. Bot players can complete setup and combat autonomously.
7. State remains consistent through concurrency, retries, and reconnection.
8. Match lifecycle, termination, and rematches work.
9. History and replay are accurate and privacy-aware.
10. Existing permissions, identity, and entitlement rules are respected.
11. UI is responsive, accessible, and consistent with the rest of the product.
12. Executable specs and automated verification pass.
13. Existing Chess, Quoridor, Connect Four, and Tic-Tac-Toe behavior remains intact.
14. Production observability and health coverage are integrated.
15. No mandatory capability is replaced with a placeholder or manual workaround.

**Specification authority:** Existing product standards govern shared functionality; this document defines Battleship-specific rules, hidden-information requirements, and integration behavior. Resolve conflicts explicitly rather than creating accidental divergence.
