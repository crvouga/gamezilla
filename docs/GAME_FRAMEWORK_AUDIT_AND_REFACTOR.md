# Reusable Game Framework Audit & Refactor

## Mission

Audit and harden the game framework after adding or changing a game, game mode, or shared capability. Inspect the real implementation, identify demonstrated weaknesses, implement the smallest coherent corrections, and verify the affected integrations end to end.

**The product is an opinionated, extensible, plugin-based game application framework—not a collection of independently implemented games.** We intend to depend heavily on its public contracts while continually adding games. Each integration must increase the framework's reusable knowledge rather than multiply screens, workflows, edge cases, specifications, and test suites.

The highest-priority invariant is **complete architectural independence of the framework from concrete games**. Games consume framework contracts. The application composition root supplies concrete games. The framework must never depend back on them.

The equally important verification invariant is:

> **Implement shared behavior once. Specify it once. Author its reusable verification once. Execute that verification independently against every applicable game and mode.**

This procedure is reusable. It is not an instruction to redesign the framework on every run. Retain sound abstractions, fix evidenced defects, and stop when the acceptance criteria are satisfied. A clean audit that requires no implementation changes is a valid outcome.

Do not stop at recommendations when an in-scope correction can be implemented and verified. Do not add unrelated production games, modes, infrastructure, or speculative capabilities.

---

## 1. Invocation and scope discovery

This prompt must work without editing its contents or supplying mandatory placeholders.

The caller may optionally provide:

- The game, mode, capability, pull request, or commit range to audit.
- A known integration baseline or target branch.
- Particular concerns, reported defects, or additional constraints.

When those are absent, determine the integration from the current branch, working-tree changes, recent relevant commits, registry changes, specifications, and implementation history. Record the inferred scope and exact baseline. Do not assume the newest commit contains the entire integration.

For an unmerged branch, inspect the relevant changes against its actual target branch. For an already-merged integration, inspect the relevant merge, squash, or implementation commit range. Do not treat an empty comparison with `main` as proof that nothing changed. If the exact boundary cannot be established, state that limitation and audit the identifiable integration without inventing a baseline.

Focus deep inspection on the integration and its affected shared contracts and consumers. Check framework-wide architectural boundaries and conformance enrollment, but do not use this task as permission to rewrite unrelated systems.

**Discover the current registered games and modes. Never hardcode today's catalog into this procedure.** Examples below illustrate architectural distinctions; they do not establish which features currently exist.

## 2. Read current authority and preserve repository constraints

Before editing, read the current `AGENTS.md`, repository briefing, `specs/README.md`, framework and game-authoring documentation, relevant executable specifications, package manifests, public exports, registration/composition code, architectural checks, and test/CI definitions.

Use current repository instructions and executable product contracts as authority. Previous agent summaries, completed hardening prompts, and passing test counts are leads to investigate—not proof of the implementation's quality.

Preserve:

- Existing `apps/`, `libs/`, `pkgs/`, bounded-context, runtime-category, naming, source-layout, and package-export rules. Do not rename packages merely to impose a different aesthetic.
- Spec-first changes and any required separation of specification and implementation commits. Do not silently change product behavior to make a refactor easier, or rewrite a specification to bless a bug.
- Centralized permission and product-policy ownership; established sync, room, matchmaking, persistence, and telemetry boundaries.
- Injected time, timers, IDs, randomness, I/O, deterministic execution, public-interface testing, and established property/model-testing conventions.
- The approved development launcher, branch/worktree, commit/push process, and CI/report-retention policies.

Preserve unrelated working-tree changes. Do not create or switch branches/worktrees, merge, deploy, modify production infrastructure, or manipulate real accounts outside the user's authorization and repository rules. Do not weaken checks, add retries to hide failures, or introduce skipped tests or bypass flags.

Resolve ordinary engineering choices from the repository and this mission. If a genuine blocker prevents verification or a safe correction, document it precisely, continue independent work, and do not claim completion.

## 3. Establish a baseline and an integration-friction ledger

Before refactoring, inventory the integration's production changes, framework changes, public contracts, schemas, specifications, fixtures, test enrollment, routes, persistence changes, and generated outputs. Run the relevant baseline checks where practical.

For every meaningful change outside the game or mode's own implementation, classify it:

| Classification | Interpretation |
| --- | --- |
| Composition wiring | Expected registration or checked harness binding at an authorized boundary. |
| Unique game behavior | Rules, state, specialized input/rendering, content, or domain-specific strategy that should remain in the plugin. |
| Reusable capability extension | A demonstrated new semantic requirement with a general contract and conformance obligations. |
| Shared framework correction | A defect or missing guarantee that should be fixed once for all eligible consumers. |
| Product policy | An entitlement, permission, ranking, or other policy owned by its existing product context. |
| Architectural leakage | A concrete-game branch, copied workflow, private API dependency, oversized adapter, or other violation. |

Record important findings with concrete file/symbol references, affected contracts and consumers, observed evidence, impact, proposed correction, and the verification that will demonstrate it.

Distinguish **proven defects**, **test/coverage gaps**, **justified specialization**, and **speculative improvements**. A suspicion is not a proven bug. A relevant source-level dependency violation can be established by structural evidence even when no user-visible failure has occurred.

For behavioral defects, capture a deterministic failing regression before fixing them where feasible. For architectural violations, capture a failing dependency, type, composition, or conformance check. Preserve the original reproducer and bug identity where one exists.

Prioritize correctness, unauthorized disclosure, data integrity, game coupling, missing required verification, and duplicated common behavior. Do not turn unrelated cleanup or hypothetical flexibility into release-blocking work.

---

## 4. Prove framework independence and correct plugin boundaries

Enforce the dependency direction:

```text
Application / authorized composition root
  ├── framework contracts and implementations
  ├── concrete game plugins ────────────────> framework contracts
  └── integration harness bindings ────────> shared suites + concrete plugins

Framework internals and shared suite implementations must not depend on
concrete production games or their fixtures.
```

Inspect direct and transitive dependencies, type-only imports, barrels, manifests, generated code, dynamic imports, implicit defaults, global registries, and helper functions that hide concrete-game switches.

The framework must not contain Chess rules, Connect Four types, Battleship defaults, or another game's assumptions inside shared lifecycle, matchmaking, puzzle, history, rendering-shell, persistence, or conformance implementation.

The application composition root may enumerate concrete plugins and game-specific schema codecs. An integration harness may instantiate a generic suite with actual games. Neither exception permits those dependencies inside the reusable framework or suite itself.

Verify that:

- Games do not import sibling game implementations, fixtures, or private modules.
- Plugins consume supported public APIs rather than framework internals.
- Framework compilation and isolated tests work without production game packages in their required dependency closure—not merely with games hidden from the menu.
- Empty registration has a defined outcome, and a bounded test-only consumer can exercise contracts requiring a game.
- Match identity, registration, state, subscriptions, caches, and fixture data remain isolated across games, modes, and concurrent instances as their contracts require.

Use existing structural checks and actual isolated execution. A text search alone is not proof. Reuse the existing reference consumer rather than creating another dummy game on every audit.

Prefer the existing typed plugin/capability model when it expresses the boundary well. Do not introduce a plugin manager, dynamic discovery system, inheritance hierarchy, or plugin hook for every function just to make the architecture sound extensible. Source-controlled plugin modularity is not, by itself, a sandbox for executing untrusted third-party code.

## 5. Keep the public API opinionated, cohesive, and extensible

Review the integration as a consumer of a long-lived framework API.

The framework should own common orchestration and invoke focused plugin contracts. Games should supply their mechanics—not reconstruct lifecycle orchestration from dozens of hooks.

Require one obvious, documented integration path with:

- A small core for genuinely universal responsibilities.
- Cohesive optional capabilities with explicit dependencies and supported combinations.
- Typed, bounded extension points for rules, state, configuration, participant views, input/rendering, results, and specialized strategies or content.
- Framework-owned defaults for common application behavior.
- Actionable compile-time or registration failures for invalid definitions, plus runtime validation of untrusted inputs.

Reject god interfaces, boolean-flag soup, excessive optional methods, weak configuration bags, unchecked casts, service locators, ambiguous ownership, and callbacks that allow plugins to bypass framework guarantees. Ordinary typed rendering or strategy injection is legitimate; the problem is uncontrolled authority, not callbacks themselves.

For relevant public operations, define the caller, permitted lifecycle states, authority, side effects, validation, idempotency, cancellation, failure propagation, cleanup, and persistence obligations. Verify ownership at capability intersections such as matchmaking-to-game handoff, stale bot work after termination, completion-to-history, and reconnect during a phase transition.

### Different games and modes must remain expressible

Do not assume all games have two opponents, alternating turns, public canonical state, a rectangular board, a winner, clocks, bots, matchmaking, or puzzles. Inspect whichever differences the new integration introduces: player counts, teams, setup phases, asymmetric views, random inputs, simultaneous actions, scoring, continuous input, puzzle progression, or other mechanics.

Do not prebuild every possible game shape. Prove the relevant distinction with the real integration or a bounded public-API consumer. State unsupported shapes honestly.

A new game or mode using established capabilities should need only its domain code, presentation, focused fixtures, and composition wiring. A genuinely new requirement may justify a focused framework extension with shared specifications and tests. **Zero framework changes is not the goal; zero concrete-game exceptions in framework internals is.**

Modes should reuse their game's rules and capabilities where semantics match, without becoming copied applications. Define meaningful mode differences explicitly. Keep room identity, queue compatibility, result attribution, history, and replay associated with the correct mode/ruleset when required.

## 6. Verify one consistent shared experience and automatic propagation

Audit the actual runtime paths for all affected game/mode combinations—not only the component names.

The framework should own applicable discovery/menu layouts, mode selection, matchmaking, custom-game setup, gameplay shells, common controls, results, puzzles, history, replay, loading/error/offline states, accessibility patterns, and recovery workflows. Preserve existing owners in other bounded contexts instead of absorbing them into a giant game package.

Games inject their play surface, unique controls, assets, domain terminology, and legitimate configuration. A specialized board should not require a copied screen. A mode should not clone matchmaking, history, or puzzle orchestration.

**An improvement to a canonical shared screen or workflow must reach every applicable consumer through normal composition, without edits to individual games.** Investigate copied implementations, per-game defaults that shadow new defaults, duplicate controllers, replacement routes, and wrappers that silently fork behavior.

Prove propagation through dependency/composition evidence and affected consumer tests. Do not add an arbitrary product change merely to demonstrate propagation. A useful shared regression or a focused contract test is sufficient.

Consistency does not require forcing distinct experiences into the same policy. A rated puzzle feed and ordered puzzle packs can share attempts, persistence, controls, and history while using different discovery and progression contracts. Optional functionality must be genuinely optional—no fake puzzle providers, empty bots, or disabled placeholders required by unrelated games.

Shared infrastructure improvements should propagate; historical game rules must not silently change. Respect pinned rulesets and compatibility policies for saved matches and puzzles.

For multiple client languages, use canonical framework implementations within each client and shared behavioral contracts across clients. Do not claim a TypeScript UI change automatically updates independently implemented Swift UI; verify parity through the applicable matrix.

---

## 7. Audit specification ownership as rigorously as production ownership

**Reusable production code with game-specific copies of its specifications is an incomplete framework. Sharing test helpers while copying the suites is also incomplete.**

Review the integration's scenarios, steps, properties, models, decisions, regressions, harnesses, and journeys, together with existing consumers of affected capabilities. In particular, find common behavior still owned only by the first game that implemented it, such as Chess.

Classify each meaningful guarantee as framework behavior, optional capability behavior, product policy, unique game/mode behavior, or redundant coverage. Move shared guarantees to their actual owning framework, matchmaking, room, spaces, puzzle, or other context. Do not force every shared spec into one enormous folder or move product policy into product-agnostic packages.

The desired ownership is:

- **Shared contracts:** comprehensive common workflows, failure modes, concurrency/recovery guarantees, and regression knowledge, parameterized across eligible consumers.
- **Game/mode contracts:** the mechanics, content semantics, and rules that actually distinguish that game or mode.
- **Harness bindings:** minimal domain inputs and observations needed to exercise those shared contracts.

A large Chess specification corpus is not automatically wrong. Castling and promotion remain Chess-specific. Generic queue cancellation, puzzle attempt recovery, duplicate completion, and history attribution should not remain Chess-only merely because they were first discovered there.

### One canonical source, real parameterization

A shared Gherkin scenario must bind to the actual selected game, mode, configuration, actions, and observations. Renaming “Chess” to “game” while constructing Chess internally is not generalization.

Do not copy feature files, commit generated per-game copies, or maintain every game's name in every Scenario Outline. Scenario Outlines are appropriate for behavioral examples; registry-derived game enrollment belongs to the shared binding/planning mechanism.

Keep scenarios precise and observable. Do not replace concrete recovery, history, or privacy assertions with “the game works,” “the state is correct,” or “the page opens.” Retain the accepted actions, independent expected observations, identities, result counts, and timing/order conditions that establish the guarantee.

Share appropriate Quint models, properties, DMN decisions, Alloy constraints, and objectives when semantics match. Do not require every behavior to appear in every specification language. Different verification layers may legitimately provide complementary evidence without becoming duplicate sources of behavioral truth.

Preserve spec-first conventions, ownership, stable scenario identities, generated step catalogs, product-statechart links, fingerprints, and evidence provenance. Maintain a concise old-to-new mapping for migrated scenarios and assertions. Remove redundant originals only after replacement protection is demonstrated.

## 8. Make game × mode conformance automatic and complete

Use the existing infrastructure to derive required verification from:

```text
Registered game
  × supported mode / ruleset
  × applicable capability contract and shared scenario
  × meaningful configuration
  × required driver / client / runtime where implemented
```

This is a constrained matrix—not a blind Cartesian product. Reconcile the production registry, mode definitions, product promises, capability dependencies, suite applicability, harness bindings, planned cases, and results.

**Determine what must be tested before checking which fixtures or results exist.** Never discover required coverage by intersecting games with available fixture files; a missing fixture must not erase its own verification obligation.

Enforce:

1. Every eligible game/mode receives the owning shared suites automatically.
2. Adding a compatible game/mode enrolls existing scenarios without editing suite bodies or per-suite lists.
3. Adding a shared scenario enrolls existing compatible consumers without editing their test implementations.
4. A missing binding, unknown required capability, empty required suite, omitted required case, duplicate/misattributed result, or absent required evidence fails verification.
5. Unsupported behavior is explicitly not applicable, with a reason. Declared but unverified support is not a pass.
6. Games cannot opt out of required assertions, substitute another game's fixture, or hide existing product obligations by dropping a capability flag.

Use stable case identities that distinguish contract, scenario, game, mode/ruleset, relevant configuration, driver/runtime, and seed or trace as needed. Each required instance needs its own execution evidence or valid exact-input cached result. A passing Chess case cannot count as a passing Connect Four case; a headless case cannot count as a browser case.

### Audit the applicable suite families

| Family | Inherited coverage to inspect |
| --- | --- |
| Registration and shared UI | Valid capabilities, supported modes, route composition, common controls, accessibility, empty/error states. |
| Custom games | Configuration, invitations/participants, start, cancellation, completion, rematch, cleanup, recovery. |
| Matchmaking | Eligibility, compatibility, duplicate admission, cancellation/assignment races, handoff, cross-game/mode separation. |
| Multiplayer | Authority, authorization, action rejection, ordering, retry safety, reconciliation, reconnect, phase and terminal consistency. |
| Puzzles | Acquisition, attempts, appropriate feedback, optional hints/retry/solution/undo, completion, progression, persistence, recovery. |
| History and replay | Identity, mode/ruleset, participants, result, logical uniqueness, authorized retrieval, reconstruction, compatibility. |
| Bots, clocks, spectators | Valid participant views, stale work, timing semantics, cleanup, supported capability interactions. |

These are audit categories, not instructions to add unsupported features.

Keep framework implementation tests, real-plugin conformance, unique game-rule tests, and full-product integration checks distinct. Low-level framework tests need not be repeated per game when no consumer-specific obligation is being checked. Conversely, a reference consumer cannot substitute for production-plugin integration evidence.

Bound configuration exploration using meaningful equivalence classes and existing PR/nightly profiles. Do not make CI tractable by silently removing an eligible game's required coverage. More games may require more executions; they must not require more maintained copies of shared test logic.

## 9. Keep shared suites substantial and per-game fixtures small

The framework harness must own common setup, isolated worlds, participants, rooms/spaces, navigation, workflow orchestration, controlled faults, injected time, observations, assertions, evidence, and cleanup.

Games/modes provide only genuinely domain-specific inputs or operations: a valid configuration, representative legal/illegal actions, a bounded completion sequence, specialized input mapping, puzzle content, and independently meaningful expected outcomes.

A thin package-owned suite invocation may be necessary for task ownership and caching. It must not reproduce the shared scenario, assertions, or applicability rules.

Reject fixtures that implement an entire custom-game journey, recreate matchmaking, write directly into production storage to bypass required transitions, return constant success, swallow errors, poll with arbitrary sleeps, or normalize away the behavior being verified. Explicit fixture setup/seeding is acceptable where the existing harness permits it, but the behavior under test must use the real public path.

Generated actions and production validators may help exercise an integration; they must not serve as the sole oracle for their own correctness. Use independent examples, contract invariants, or appropriate reference expectations. Metamorphic and replay checks can add evidence but do not alone establish that unique game rules are correct.

Measure production integration and fixture code separately. Do not eliminate application boilerplate only to move it into a second testing application. Add focused fixture obligations only when the shared contract genuinely needs new domain information; never weaken an assertion to preserve a superficial zero-boilerplate claim.

---

## 10. Challenge correctness at the boundaries the integration exercises

Select concrete adversarial cases from the changed behavior and existing contracts. Do not expand every audit into speculative implementation of all these capabilities.

### Authority, concurrency, and lifecycle

Check illegal, unauthorized, stale, duplicate, and concurrent commands; start/cancel and match/cancel races; phase transitions; late asynchronous work; completion; result persistence; rematches; and disposal where applicable.

Verify that rejected actions preserve the state promised by the contract, accepted transitions have correct atomicity, retries do not duplicate logical effects, and late work cannot revive or corrupt a terminated game. Do not claim universal “exactly once” delivery; verify the actual idempotency and recovery guarantees.

Keep one owner for lifecycle, clocks, participation, and final results. Preserve the existing distinction between disconnecting, leaving, canceling, resigning, and completing; do not invent a universal policy that changes existing games.

### Private information and participant views

When private state is involved, inspect data before it reaches unauthorized clients—not just what the UI renders. Exercise snapshots, events, subscriptions, reconnect, bot inputs, history/replay, errors, caches, and relevant logs or telemetry.

State agreement does not require sending identical canonical state to everyone. Verify agreement on shared facts and the correctness of each authorized projection. Preserve the explicit reveal policy during and after a game; completion must not silently grant omniscient history access.

Use meaningful privacy/noninterference checks where applicable. Do not expose private information through generic debugging or comparison helpers introduced by the audit.

### Persistence, offline behavior, and deterministic recovery

Exercise the promised offline/reconnect paths, restart boundaries, pending operations, duplicate synchronization, and historical reconstruction. Keep durable sync records separate from authoritative room state according to existing ownership.

Do not make online-only actions silently execute later. Verify deterministic behavior under the same injected inputs, while keeping canonical server hashes distinct from permitted client-view hashes.

### Puzzle and content differences

When puzzles are affected, distinguish the puzzle definition, ruleset, attempt, content source, discovery mode, progression, and scoring policy. Avoid treating every puzzle as a rated Chess feed or requiring a particular stored move sequence.

Reuse common attempts and persistence across supported feed/pack experiences without forcing identical hint, undo, retry, completion, or rating semantics. Accept solutions according to the game's rules, not merely equality with one stored answer.

If generation or publication changed, verify stable content identity, reproducibility/versioning, validation, and deduplication as required. A solver timeout is not proof of unsolvability or uniqueness. Do not build a new generator or editor just because the capability is mentioned here.

### User experience and resource ownership

Verify common navigation and controls through the real composition, including focus, keyboard/touch input, reduced motion, loading, rejection, and recovery as applicable. Game-specific interaction remains independently testable.

Inspect listeners, timers, background work, and memory across route changes, mode switches, rematches, and teardown. Measure relevant performance against existing budgets and a comparable baseline; do not claim “no regression” from visual inspection or an unexecuted benchmark.

## 11. Preserve regressions and test the conformance system itself

**The game that exposes a shared defect is its first witness, not its permanent sole owner.**

For each discovered or migrated regression, preserve its identity, concrete counterexample, expected result, and relevant timing/order. Add the generalized failure mechanism to the owning shared suite so every compatible game/mode inherits it.

Retain the exact original game-specific reproducer when its input cannot be represented faithfully by a generic fixture. Do not replace a precise regression with “some legal action succeeds.” Follow existing known-bug, property, model-trace, and seed-pinning conventions.

Use existing verifier tests, extending them only where the new integration exposes a gap. Demonstrate:

- Registering a compatible test consumer enrolls existing scenarios without suite edits.
- Adding a shared scenario enrolls existing eligible consumers without per-game test edits.
- Missing fixtures, required cases, or results cannot silently pass.
- A wrong game/mode/driver attribution cannot satisfy another required case.
- Selected intentionally faulty test-only consumers are rejected for the expected contract violation.

Choose faults relevant to the change: for example, duplicate logical completion, an unauthorized view, an omitted binding, incorrect result attribution, or stale bot work. Use assertions that pass when the verifier detects the intended fault—not permanently failing/skipped tests, production corruption, or unsafe fault injection into real environments.

Do not demand a whole mutation-testing system on every run. Reuse small deterministic probes and prove meaningful sensitivity where needed. Verify fixture isolation, cleanup, and independence from case ordering.

## 12. Remove demonstrated anti-patterns without creating new ones

Inspect affected code, specs, and tests for:

| Anti-pattern | Required direction |
| --- | --- |
| Game-ID branches, implicit Chess defaults, sibling imports | Restore dependency direction and typed plugin contracts. |
| Copied screens, controllers, mode workflows, or test suites | Reuse the canonical implementation and parameterize execution. |
| Giant interfaces/configuration bags or optional-method soup | Cohesive contracts with explicit capability obligations. |
| Hidden mutable registries, order-dependent initialization, global fixture state | Explicit composition, scoped ownership, isolation, and cleanup. |
| Private API imports, unsafe casts, uncontrolled hooks | Supported extension points with checked semantics. |
| Duplicate lifecycle, permissions, persistence, or result authorities | Restore the existing owning context and one authoritative path. |
| Circular or vacuous assertions, missing matrix cells, fabricated passes | Independent expectations, completeness reconciliation, attributable evidence. |
| Wrapper-only layers, speculative abstractions, abandoned shims | Delete unnecessary indirection and complete justified internal migrations. |

Do not ban ordinary conditionals, legitimate game-specific rule tests, or small local functions. Similar syntax does not establish shared semantics. Never extract an abstraction solely to reduce line count or make a spec folder smaller.

Add inexpensive structural or behavioral guards for important demonstrated violations using existing tooling. Do not build an unreliable “duplicate detector” and treat it as proof that all duplication is gone.

## 13. Preserve contract evolution and language independence

Audit compatibility obligations touched by the integration: persisted state, offline records, accepted events, replay data, configuration, public routes, generated bindings, and supported older clients.

Keep ruleset/schema identity and migration responsibilities explicit where needed. Updating framework code must not silently reinterpret old matches. Complete internal API migrations according to repository conventions without leaving unnecessary parallel workflows or deprecated shims; retain external/data compatibility mechanisms where the actual contract requires them.

At language/process boundaries, keep contracts independent of TypeScript runtime objects, Solid signals, callbacks, or platform internals. Check relevant serialization semantics such as integer ranges, absent/default values, enum evolution, ordering, and deterministic encoding rather than assuming generated types establish compatibility.

Use existing authoritative schemas and code generation. Do not introduce a competing schema system or rewrite the server/client stack as part of an audit. Native types and functions inside a language-specific implementation are appropriate.

If multiple implementations already exist, run their applicable contract checks and relevant mixed-client journeys. Respect the reference client's declared scope; do not port the entire game catalog merely to fill imaginary matrix cells. Report precisely what is and is not proven across languages.

---

## 14. Execute repairs in bounded, verifiable increments

Follow this sequence, adapting command names to the current repository rather than inventing a new workflow:

1. **Discover and baseline.** Establish scope, authority, dependency/ownership maps, relevant current behavior, expected matrix coverage, and baseline failures.
2. **Establish evidence.** Reproduce behavioral defects or encode architectural/coverage violations. State what is wrong and which contract owns the correction.
3. **Specify first.** Add or generalize authoritative specifications and preserve regression mapping before the corresponding implementation, following required commit rules. A disputed product policy is not permission to invent a new behavior.
4. **Repair the owner.** Make the smallest coherent game-independent correction. Keep unique mechanics in plugins. Update every affected consumer and remove redundant internal paths in the same complete migration.
5. **Strengthen shared verification.** Generalize suites, fixtures, and applicable models; reconcile automatic matrix enrollment; test the verifier where the change warrants it.
6. **Validate progressively.** Run focused checks while iterating, then the affected existing consumers and the required release gate. Run relevant deeper checks through the existing profiles.
7. **Close and document.** Remove dead code and obsolete duplicate sources; update only the canonical API/onboarding documentation that changed; provide the evidence report and stop.

Reuse existing checks such as `bun check-pr`, relevant `bun check-nightly` groups, and Atlas where they remain the repository's supported commands. Use the approved local or remote execution route; do not assume all environments or credentials are available.

Preserve bounded deterministic PR checks and current report-retention rules. Deeper nightly execution must reuse authoritative contracts, not introduce a second behavioral implementation. No required release correctness may be silently deferred merely to obtain a green PR result.

Keep package-owned task granularity. Cache inputs must include relevant specs, suites, framework dependencies, concrete plugins/modes, fixtures, generated contracts, profiles, and platform/toolchain inputs where necessary. Shared changes invalidate affected consumers; unrelated game changes should not invalidate everything without a real dependency.

Run verification against the final candidate, not only an earlier intermediate revision. Valid exact-input cached evidence is acceptable; stale reports and another matrix cell's pass are not. Distinguish freshly executed and restored results, test driver fidelity, targeted checks, full gates, and unexecuted work.

For a blocker, record the command, failure, environment limitation or dependency, affected guarantees, and remaining check. Do not fabricate success or use test relaxation as a workaround. Report pre-existing failures separately without pretending the full gate passed.

## 15. Required final report

Use the existing report/PR conventions. Keep the report concise, source-linked, and evidence-based; avoid creating a second permanent specification system.

Include:

### A. Scope and verdict

Identify the game/mode/capability, integration baseline and reviewed revision, inferred assumptions, affected shared consumers, and one verdict: **ready**, **not ready**, or **verification blocked**. Explain the verdict in terms of the acceptance criteria, not a subjective quality score.

### B. Findings and corrections

For each significant finding, provide its evidence, owner, impact, correction, regression/architectural guard, and status. Record justified specializations and material unresolved limitations. A zero-defect result is acceptable when supported by the checks performed.

### C. Reuse and propagation

Show which screens/workflows were already canonical or consolidated; which specs, assertions, and regressions moved to shared owners; and which game-specific rules correctly remained local. Include original-to-replacement references where coverage moved.

Separate authored shared scenarios/suites from generated execution counts. Explain whether adding the integration increased unique domain code, necessary fixtures, or duplicated infrastructure. Do not use raw lines removed as proof of quality.

### D. Actual conformance matrix

Report the discovered game/mode/capability coverage, required case counts, relevant drivers/implementations, and actual outcomes. Use existing machine-readable output when available. Include not-applicable reasons and missing/failed/blocked evidence. Do not substitute an illustrative table for actual results.

### E. Framework independence and onboarding

Report the structural and framework-only checks, independent-consumer evidence, automatic enrollment in both directions, verifier sensitivity, and integration friction. Identify any framework API changes and why they were reusable rather than concrete-game exceptions.

State exactly what a new game/mode using existing capabilities would need to add. Distinguish composition registration, production plugin code, domain specs, and fixture code from shared internals that should not need edits.

### F. Verification and residual risk

List commands and scope, outcomes, relevant compatibility/performance evidence, valid cache reuse, and anything not run. Do not claim native-client, browser, privacy, or performance coverage beyond the evidence obtained.

## 16. Acceptance criteria and stopping rule

Do not declare the integration ready unless the applicable requirements below are verified:

- [ ] Framework and shared-suite implementations have no direct or indirect concrete-game dependencies; authorized composition is the explicit exception.
- [ ] Games remain independent peers, and framework-only checks do not require production games.
- [ ] Shared screens and workflows have canonical owners; improvements reach all applicable consumers without per-game copies or overrides.
- [ ] Public API and capability contracts remain cohesive, opinionated, explicit, and sufficient for the demonstrated game/mode variation.
- [ ] New functionality uses supported extension points; any new framework capability is justified, game-independent, and verified.
- [ ] Common specifications, assertions, edge cases, and regressions are shared and parameterized; unique game rules and exact bug reproducers remain protected.
- [ ] Every required game/mode matrix instance is enrolled automatically and has attributable evidence. Missing bindings or coverage cannot silently pass.
- [ ] New consumers inherit existing shared scenarios, and shared scenarios reach existing eligible consumers without copied sources or per-suite lists.
- [ ] Game fixtures stay focused; framework harnesses own common orchestration and assertions.
- [ ] Relevant authority, privacy, lifecycle, persistence, compatibility, cleanup, accessibility, and performance contracts remain intact.
- [ ] Existing affected games/modes and any required cross-language consumers have been verified at the required fidelity.
- [ ] The final candidate satisfies required gates, with no weakened checks, skips, retries masking defects, or fabricated results.
- [ ] Canonical documentation reflects actual API changes; obsolete duplicate paths have been removed.

Stop when demonstrated in-scope defects are corrected, required verification is satisfied, and material limitations are recorded. **Do not keep generalizing until the framework theoretically supports every future game.**

Do not implement another production game, introduce another language/runtime, or create a new reference plugin unless the bounded audit actually requires that specific probe and it fits the authorized scope. Reuse established probes on subsequent runs.

If an applicable criterion remains unmet, report **not ready** or **verification blocked**, with precise evidence and the remaining action. Do not present an unverified integration as complete. Unrelated speculative improvements belong in a separate backlog, not an endless audit loop.

## Final directive

Act as an independent framework engineer, not a defender of the implementation being reviewed. Challenge the integration with real evidence, correct the owning abstractions, and retain everything that already works well.

**The framework must remain independent of every concrete game, opinionated enough to keep the experience consistent, and extensible through a small set of deliberate contracts.**

**Each game should contribute its unique mechanics. The framework should supply the common experience, workflows, executable specifications, test orchestration, and accumulated edge-case knowledge.**

The intended result of each run is a simpler or better-proven framework that makes the next game or mode easier to implement correctly—not another layer of abstractions or another suite of copied tests.
