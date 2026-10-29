# Final Game Framework Architecture, Decoupling & Conformance Hardening

## Mission

Perform a final, independent, adversarial architecture and correctness hardening pass on the product's game framework.

Several refactoring and hardening passes have already been completed. **Do not assume those passes established a genuinely reusable framework.** Audit the implementation as it exists today, retain sound decisions, correct structural weaknesses, and remove unnecessary complexity and anti-patterns.

We intend to build and operate the product as a profitable gaming platform for the next 10–20 years. Hundreds of different games may eventually depend on this framework. We will be **deeply coupled to its public contracts**, so their quality and stability are among the highest-leverage investments we can make now.

**The single most important requirement is absolute architectural independence from any concrete game.** The game framework must not know about Chess, Connect Four, or any future game. Concrete games depend on the framework and are supplied to it through explicit, typed, composition-root-controlled extension contracts. The framework must never depend on concrete games, directly or indirectly.

Equally important: the framework must own the common user experience, business workflows, executable specifications, regression knowledge, and conformance tests. Adding a new game should require almost exclusively its unique mechanics and a small amount of integration and fixture code.

This is **not** another feature-development effort, a cosmetic reorganization, or a request to generate speculative abstractions. It is a final quality, correctness, maintainability, and extensibility audit followed by the concrete repairs required to meet the standards below.

**Do not add new production games. Do not stop at a design proposal. Implement and verify necessary corrections end to end.**

---

## 1. Non-negotiable architectural invariants

Treat these as enforceable contracts, not aspirational guidelines.

1. **Framework → concrete game dependencies are forbidden.** Framework production packages must not import, reference, dynamically load by concrete name, or depend transitively on Chess, Connect Four, or other game implementations. This also applies to shared screen implementation, state management, domain logic, matchmaking, puzzle workflows, bots, persistence, and the core conformance machinery.
2. **Concrete games are independent peers.** No game implementation imports another game's implementation or relies on another game's fixtures, state, identifiers, routes, or tests.
3. **Composition owns the concrete list.** The authorized application/runtime composition root may import concrete plugins to register them. This is the explicit exception; do not create additional hardcoded registries or game-ID branches throughout the framework.
4. **The framework works with zero production game plugins.** The framework and its own isolated tests must be buildable and meaningful without Chess or Connect Four registered. Use a small test-only reference implementation when needed to exercise its extension contracts.
5. **Adding a game is additive.** A new game using established capabilities must not require edits inside framework-owned workflows, existing game packages, shared screen bodies, or shared specification/test-suite sources. An explicit composition entry and minimal checked harness binding are acceptable.
6. **Shared behavior has one owner.** Screens, custom games, matchmaking, multiplayer integration, puzzles, history, replay, recovery, bots, and their common rules must not be independently reimplemented for each game.
7. **Capabilities are enforceable promises.** Advertising a capability requires its correct implementation, behavioral obligations, and automatic conformance coverage. A missing binding must fail verification rather than silently skip it.
8. **Common specifications and tests are shared and parameterized.** A new compatible game automatically inherits the relevant existing edge cases; no copied Gherkin, parallel assertion logic, or per-suite game lists.
9. **The framework is opinionated about application behavior, flexible about game mechanics.** It should provide one canonical way to build consistent game experiences without requiring that games share the same board shape, action model, player count, information visibility, or terminal conditions.
10. **The framework must not be over-engineered.** The smallest coherent public API, clear ownership, and simple defaults are more valuable than maximal configuration or abstraction count.

If any existing implementation violates these invariants, treat it as a defect even if the current Chess and Connect Four tests happen to pass.

---

## 2. Begin with an independent, evidence-based audit

Read `AGENTS.md`, the repository briefing, `specs/README.md`, current manifests, exports, package-boundary rules, plugin registration, framework documentation, existing Chess and Connect Four packages, conformance runners, and the relevant executable specifications before modifying anything.

Use the actual repository as the source of truth. Its current naming, `apps/` / `libs/` / `pkgs/` boundaries, runtime categories, flat-source conventions, and composition rules take precedence over invented package layouts.

Produce an internal inventory covering:

- Public framework contracts versus implementation details.
- The dependency graph from every framework package to concrete games and back.
- Every place a game ID, Chess or Connect Four type, fixture, rule, route, configuration, or special case appears in ostensibly shared production code.
- Shared screen and workflow ownership, including hidden forks, duplicated controllers, wrappers, and fallback paths.
- Game-specific executable specifications, steps, Quint models, properties, regressions, harnesses, and browser tests that actually express shared behavior.
- Capability declaration, implementation, fixture enrollment, and conformance-runner wiring.
- Unnecessary API complexity, boilerplate, performance overhead, and CI invalidation.

Classify findings as proven defects, justified game-specific behavior, necessary framework responsibilities, or speculative improvements. **Prefer defect-driven changes over churn.** Do not replace a sound design merely to introduce a new abstraction.

---

## 3. Prove complete independence from concrete games

This is the highest-priority technical deliverable.

### 3.1 Dependency direction

Enforce this model:

```text
Product application / authorized composition root
                 |
                 +---> game framework contracts and implementations
                 |
                 +---> Chess plugin -----------+
                 +---> Connect Four plugin ----+--> depend on framework
                 +---> future game plugins ----+

Framework packages must NEVER depend back on the concrete plugins.
```

Enforce boundaries against direct imports, barrel exports, type-only imports, dependency manifests, generated output, indirect imports, runtime registration, test helpers accidentally used in production, and concrete-game switches disguised behind utility functions.

A generic framework test suite can be *executed with* concrete games by the harness composition layer; that does not authorize the suite implementation itself to import those games or use Chess as an implicit default.

### 3.2 Zero-game and independent-consumer proof

Provide an executable check that can compose, build, and test the framework with **no production game plugins registered**. Where meaningful coverage needs a game, use a bounded, framework-owned **test-only plugin** that consumes the public API but is not shipped.

Then prove that a new independent test consumer can register and receive the framework's functionality without editing framework internals or copying existing games.

The acceptance proof must fail if a framework package secretly depends on Chess or Connect Four. Do not merely grep for game names and declare success; use dependency graph checks, isolated composition, and real execution.

### 3.3 No concrete-game conditionals

Remove branching such as `gameId === 'chess'` or `switch (gameType)` from generic lifecycle, screen, matchmaking, puzzle, and history code.

Replace it with the smallest appropriate typed capability contract or injected behavior. **Do not** replace one switch with a global service locator, unsafe cast, giant callback bag, or another equivalent hidden dependency.

Application composition may enumerate concrete game registrations. Game implementations may branch on their own domain-specific state. Keep the prohibition focused on framework coupling.

---

## 4. Finalize a rock-solid, opinionated, extensible public API

Treat the game framework API as a durable engineering product that hundreds of future plugins may consume.

### 4.1 Cohesive contracts and clear ownership

Distinguish:

- **Core game contracts:** responsibilities genuinely shared by every game.
- **Capability contracts:** multiplayer, matchmaking, custom games, bots, puzzles, spectating, clocks, history, replay, and other optional experiences.
- **Product integration:** Product-specific permissions, accounts, spaces, policies, navigation, and runtime composition.
- **Implementation details:** transports, storage mechanisms, SolidJS internals, orchestration helpers, and other details that plugins should not access.

Avoid a god interface, giant `GameConfig`, universal state shape, excessive generics, dozens of mandatory hooks, or optional-method soup. Prefer small, discoverable, strongly typed contracts with sensible framework-owned defaults.

Each public contract must define not only types but also **semantics**: caller, lifecycle preconditions, ownership, validation, authority, idempotency, cancellation, failure propagation, cleanup, and persistence where relevant.

Invalid capability combinations and missing required implementations should fail early with actionable errors. Use compile-time checks where possible and runtime validation at untrusted boundaries.

### 4.2 Opinionated defaults, constrained extension points

The framework must decide how common screens, game creation, matching, multiplayer handoff, recovery, result presentation, and history work. Plugins provide only domain-specific state, actions, rules, views, rendering, input, configuration, and specialized strategies or content.

Do not allow each game to bypass shared workflows, replace entire screens by default, or override internals with unrestricted lifecycle callbacks. Genuine variation should use **explicit extension points with conformance obligations**.

One obvious documented integration path must exist. Avoid competing registration systems and multiple equally plausible ways to implement a capability.

### 4.3 Evolve without repeatedly rewriting the framework

Evaluate how local the changes are for:

- A new game using existing capabilities.
- A game with a different player count or action model.
- A puzzle-only game.
- A game with asymmetric or hidden participant information.
- A new optional capability.
- An internal framework implementation change.
- A serialized state or network protocol evolution.

The goal is to **minimize future breaking changes**, not to pretend all future game designs are known today. Do not add speculative hooks without a real or bounded reference consumer demonstrating need.

Where persisted state, offline clients, room protocols, or historical records require it, establish explicit compatibility and migration semantics. Do not introduce permanent deprecated shims or duplicate implementations in violation of repository conventions.

---

## 5. Support fundamentally different kinds of games

Challenge the framework with representative *shapes of behavior*, not only Chess and Connect Four:

- Two-player, turn-based, perfect-information games.
- More-than-two-player or asymmetric-role games.
- Games with hidden or participant-specific state, such as Battleship.
- Games with setup and play phases or special placement rules, such as Blockade.
- Puzzle-first or single-player experiences, such as Numberlink.
- Games with different board geometries, no conventional board, or custom input models.
- Games with simultaneous, asynchronous, or otherwise non-alternating actions.
- Games with draws, scores, cooperative completion, or other results besides one winner.
- Games without bots, puzzles, replay, matchmaking, clocks, or spectators.

These are **design probes and test-only fixtures**, not requests to ship new games or prebuild all possible game mechanics.

Avoid assuming every game has exactly two players, legal moves in the chess sense, a complete state visible to all participants, a grid, a clock, or a winner.

When an edge case shows a genuine missing capability, introduce a focused and composable contract, its shared behavior, and its conformance tests. Do not add a game-specific workaround to framework internals.

Keep privacy and authority correct: generic multiplayer synchronization must never expose a participant's hidden information to the wrong person.

---

## 6. One implementation of the shared game experience

Verify that framework-owned screens and workflows are canonical across compatible games:

- Game discovery, landing and main menus, mode selection, navigation.
- Matchmaking, waiting, cancellation, match formation and handoff.
- Custom-game configuration, invitations, hosting, joining and lobby.
- Gameplay shell, participant display, status, common controls, results and rematches.
- Puzzles, hints, attempts, feedback, completion and progression where supported.
- Bots, spectating, clocks, multiplayer recovery and reconnect states where supported.
- Game history, records, review and replay where supported.
- Loading, error, empty, offline, accessibility and recovery states.

The framework owns layout and UX conventions; games inject their play surface, actions, assets, visual tokens, terminology, and justified specialized controls.

Every game should feel like the same polished product application while retaining its own recognizable identity.

Follow the repository's SolidJS, `@pkgs/ui`, accessibility, localization, deterministic I/O, performance, and mobile-first rules. Do not introduce a second client UI architecture.

Preserve the separation of durable sync state and authoritative room event state. Reuse existing room, matchmaking, spaces, and permission owners instead of building another version inside the framework.

---

## 7. Invert specification ownership: comprehensive framework specs, focused game specs

**This is a mandatory acceptance criterion, equal in importance to production-code reuse.**

The shared framework specifications should describe the full common game experience and its difficult edge cases. `specs/chess/` should principally describe what makes Chess unique. Connect Four should follow the same rule. Preserve existing bounded-context ownership: shared guarantees belong to their actual owning game, matchmaking, room, spaces, or other context—not necessarily to one physically enormous `specs/games/` folder.

Audit every Chess-specific Gherkin scenario, step binding, property, model, and regression. Classify each as:

1. Shared framework behavior.
2. Shared optional capability behavior.
3. Cross-cutting product policy belonging to another context.
4. Genuinely Chess-specific rules, puzzle semantics, notation, or evaluation.
5. Redundant coverage that can be removed without losing a guarantee.

**Promote all applicable common behavior into canonical shared specifications**, parameterized over game implementations. Do not leave a shared capability documented and verified only through Chess. Do not reduce game-specific rule tests merely to make the shared folder appear larger.

Examples that belong in shared capability specs when supported: creating and canceling a custom game, queue races, reconnect, duplicate commands, invalid authorization, stale bot results, completion idempotency, offline resume, puzzle attempt persistence, history recording, replay stability, and privacy of participant views.

Examples that remain Chess-specific: castling, check, en passant, pawn promotion, checkmate, stalemate, chess-specific puzzle correctness and position invariants.

### Shared source, parameterized execution

One canonical Gherkin scenario must execute against Chess, Connect Four, and any future compatible game **without duplicating or generating checked-in per-game feature files**.

The harness supplies minimal typed, game-specific inputs, operations, and independent expected outcomes. It does **not** supply the shared workflow or reimplement its assertions.

Preserve human-readable, observable Gherkin. Do not disguise Chess as a generic scenario through simple word substitution while leaving Chess fixtures or rules embedded in the implementation.

Generalize Quint models, properties, DMN tables, Alloy constraints, and objectives where their semantics genuinely match. Keep specialized models in the owning game. Preserve the repository's spec-first rules and specification conformance requirements.

---

## 8. Make parameterized conformance testing automatic and exhaustive within declared capabilities

**The framework must own the heavy lifting of testing. Game authors must not rediscover common edge cases or copy tests.**

The authoritative model is:

**Shared specification / test contract × registered game × supported capability × relevant configuration × execution driver / language where applicable.**

### Required shared suites

Build or harden one authoritative suite for each common behavior family, including:

- Core game definition, initialization, action rejection, lifecycle and result handling.
- Shared menus, navigation and screen composition.
- Custom-game creation, configuration, participants, start, finish and cancellation.
- Matchmaking admission, compatibility, formation, concurrent races, cancellation and handoff.
- Authoritative multiplayer commands, ordering, reconciliation, reconnect and recovery.
- Bot participation, lifecycle, interruption and stale decisions.
- Puzzle loading, valid/invalid attempts, hints/retries/solutions when supported, completion and persistence.
- Game history, participant identity, result accuracy, durability and replay where supported.
- Spectating, timers, access control and hidden-information views where supported.
- Offline recovery, idempotency, migration and cross-device behavior as required by the capability's actual guarantees.
- Relevant shared browser journeys, accessibility, visual composition and performance checks.

A capability that is not supported is **not applicable**. A capability that is declared but lacks its required suite, fixture, or evidence is **a failure**. Do not fake support with no-op implementations.

### Automatic matrix discovery

Derive enrollment from the authoritative production registry and declared capabilities, reconciled against product promises. Adding a game or adding a shared scenario should automatically create the relevant test instances; do not maintain per-suite lists of game names.

Preserve stable, unambiguous identities including game, capability, scenario, relevant configuration, driver or runtime, and seed/trace where applicable.

Every game must produce its **own** required evidence. A passed Chess test may not serve as Connect Four evidence; a reference game's pass may not satisfy production-plugin conformance. Exact-input cache reuse is fine when valid.

### Keep fixtures genuinely small

Shared harnesses own participant creation, space/room lifecycle, transport faults, time, IDs, concurrency, cleanup, actions, assertions, and result capture. A plugin supplies only minimal domain-specific known-valid and known-invalid inputs, representative transitions, and independent expectations.

Avoid recreating boilerplate in test adapters after removing it from production integrations.

### Assert meaningful behavior

A conformance suite must not ask the same implementation under test to define the expected result of its own operation. Use independent examples, invariants, reference outcomes, or meaningful black-box properties. Preserve test sensitivity to real defects.

### Composition of capabilities

Test critical interactions, not only isolated features: matchmaking into multiplayer, bots in custom games, puzzle history, cancel/reconnect races, late actions after completion, result persistence and replay, and hidden information in spectating. Avoid an uncontrolled Cartesian-product explosion; use meaningful equivalence classes and bounded profiles.

---

## 9. Promote discovered bugs into reusable framework knowledge

Chess and Connect Four have already accumulated regressions and hard-won edge cases. Audit them individually.

**The game that first exposed a shared failure is not its permanent owner.**

For each regression:

- Identify the exact failure mechanism and the contract that owns it.
- Preserve the original bug ID, concrete counterexample and reproducer.
- Add a shared generalized regression for every semantically compatible game.
- Keep a game-specific regression where its exact domain input remains necessary.
- Verify that the generalized assertion truly exercises the same failure mechanism.

Do not replace an original reproduction with a vague "some legal move succeeds" test and call the regression preserved.

Reuse appropriate property-based tests and Quint state-machine models to verify idempotency, concurrency ordering, authoritative agreement, recovery, terminal-state consistency, state privacy, and isolation. Follow existing `assertProperty`, virtual-time, fixed-seed, model-replay and regression-pinning conventions.

Future games should automatically inherit the framework's existing error cases, including the ones discovered before they existed.

---

## 10. Test the verifier and the extension system themselves

Prove not just that the registered games pass, but that the **framework would detect incorrect integrations and incomplete coverage**.

Use bounded test-only deliberately faulty consumers (expected-failure checks, not permanently failing or skipped tests) to demonstrate detection of:

- Invalid capability registration or a missing implementation.
- Missing required fixture or empty conformance-suite enrollment.
- Incorrect game attribution or accidental reuse of another game's passing evidence.
- Invalid authoritative commands being accepted.
- Duplicate completion/history records.
- Unauthorized participant views or cross-game state leakage.
- A shared scenario added without reaching an eligible game.

Test fixture order independence, isolation, cleanup and concurrency. Ensure an intentionally faulty reference plugin fails the relevant contract for the expected reason.

Prove both directions of extensibility:

1. Register a new bounded test-only game: it automatically inherits existing applicable framework specs and tests without modifying suite source.
2. Add a new shared regression: all existing eligible plugins automatically run it without per-game edits.

The test-only plugin must have no privileged private hooks that real games cannot use.

---

## 11. Eliminate framework anti-patterns systematically

Conduct an explicit anti-pattern review, and repair every **demonstrated** violation of the intended architecture. Pay particular attention to:

- Framework packages depending on concrete games, including type-only and transitive imports.
- `if chess`, game-ID switches or implicit concrete-game defaults inside shared code.
- God objects, universal game-state shapes and over-generalized rules abstractions.
- Feature/capability boolean soup, inconsistent optional methods, ambiguous null semantics.
- Unchecked casts, `any`, runtime shape guessing and magic string routing.
- Giant callback/configuration bags, service locators, uncontrolled escape hatches and lifecycle hook spaghetti.
- Circular dependencies, hidden shared mutable registries, order-sensitive initialization and leaking singleton state.
- Games implementing their own matchmaking, puzzle lifecycle, custom-game orchestration, history, screen shell, persistence or recovery logic.
- Duplicate sources of truth for lifecycle state, participants, completion, permissions or game identity.
- Incorrect ownership crossing `pkgs/`, `libs/`, subs, client/server/shared runtime categories or product permissions.
- One-off frameworks inside games and wrapper packages that add indirection without valuable ownership.
- One generic layer for every edge case rather than a focused explicit contract.
- Tests that use private implementation imports, copied suites, oversized fixtures, brittle sleeps or circular expected values.
- Gherkin that describes implementation details instead of observable behavior, or silently binds to Chess under a generic name.
- Missing registration checks, unexecuted capability specs or green results with incomplete evidence.
- Duplicate compatibility shims, obsolete abstractions, dead code and transitional APIs left behind by previous passes.
- Performance regressions from generalized rendering, excessive subscriptions, allocations, runtime registration or broad CI cache invalidation.

Do not mechanically abolish ordinary conditional logic or create abstractions for trivial code. The target is **zero known architectural anti-patterns that undermine decoupling, correctness, extensibility, or developer experience**—not maximum abstraction and not an arbitrary line-count reduction.

Enforce important rules in existing lint, package-boundary, typecheck, dependency-graph, harness and conformance gates rather than relying on documentation alone.

---

## 12. Preserve cross-language portability without unnecessary rewrites

The product is moving toward language-neutral framework contracts with TypeScript web, possible Swift Apple clients, and potentially other client/server languages in the future.

Do not bake TypeScript-specific domain assumptions, SolidJS state machinery, JavaScript callbacks, or Bun/Cloudflare runtime objects into interfaces that must cross language or process boundaries.

Keep shared wire shapes, serialization, IDs, error semantics, capability descriptors and versioned contracts portable. Use the repository's chosen canonical schemas and generated bindings where present; evaluate missing cross-language seams rather than introducing a wholesale new schema system without evidence.

Preserve native TypeScript APIs *inside* TypeScript-only implementations where appropriate. Language neutrality is a contract-boundary property, not a command to express all application code in a language-agnostic lowest common denominator.

Where an existing Swift/reference implementation exists, include it in applicable protocol and behavioral conformance. Do not manufacture Swift parity claims or expand into a second full production client in this hardening pass.

---

## 13. Make the framework cheap to adopt and maintain

The game-authoring experience should have **one canonical formula**:

1. Define game identity, metadata and capabilities.
2. Implement its domain state, rules, actions and results.
3. Provide its play surface, input and required visual assets.
4. Supply only genuinely necessary specialized capability implementations.
5. Supply focused domain correctness specs and minimal independent test fixtures.
6. Register the plugin at the authorized composition boundary.
7. Run one established validation command and receive the complete applicable conformance matrix.

The agent should not need to create new menus, copied matchmaking screens, custom-game flows, generic history tests, recovery scenarios, puzzle harnesses or repeated Gherkin files.

Make wrong integrations fail with actionable errors. Keep required files, public methods, adapters, boilerplate and documentation as small as sound architecture permits. Prefer deriving testing inputs from existing public game contracts instead of asking the author to restate them in a test-only DSL.

Keep the existing game-authoring guide concise, accurate and executable. Examples must compile and tests must run. Avoid a second parallel source of product truth.

---

## 14. CI, reliability and performance constraints

Integrate into the repository's existing checks and infrastructure. Do not introduce a rival testing system or CI workflows.

- **`bun check-pr`:** bounded deterministic, package-owned, automatically enrolled game conformance tests, with no new report-retention behavior.
- **`bun check-nightly`:** deeper exploration of the *same* specs and suites, including broader properties, model traces, browser journeys, fault recovery and visual/performance evidence where already supported.
- **Atlas:** meaningful identities and evidence for each game × capability × scenario × relevant runtime/driver. Missing, stale, unsupported and failed must not be conflated.
- **Turborepo:** dependency-aware scheduling and granular cache invalidation; changes in one game should not invalidate unrelated games unless they share a relevant changed contract or dependency.
- **Runtime:** preserve local-first behavior, offline persistence, room authority, deterministic hashing, idempotency, protocol compatibility, access control and low-end-mobile performance.

Executed verification instances will naturally increase as games are added. The target is to keep **maintained copies of shared source code, specs and test logic approximately constant**, and minimize fixture and integration overhead—not to claim unlimited games require zero additional test execution.

No skipped tests, weakened assertions, special-case CI passes, new timeout bypasses, or fabricated coverage.

---

## 15. Execution order

Work in the existing branch and worktree. Respect `AGENTS.md`, the spec-first change/commit process, package and naming rules, and restrictions on pushing or merging.

### Phase A — Audit and baseline

Map concrete-game dependencies, APIs, shared ownership, specification coverage, conformance enrollment, tests, regressions and CI costs. Preserve a baseline for comparison.

### Phase B — Repair ownership and decoupling

Make the framework independent of real games, eliminate forbidden imports and concrete branches, consolidate duplicated workflows, and verify zero-game framework composition.

### Phase C — Harden the public API

Remove conflicting entry points and accidental complexity; strengthen typed capabilities and lifecycle contracts; verify distinct game shapes through bounded consumer probes.

### Phase D — Consolidate specifications and regressions

Promote shared Chess/Connect Four behavior into authoritative, parameterized framework/capability specs while retaining actual game-rule guarantees and original bug reproductions.

Follow the repository's required spec-first commits before corresponding implementation changes.

### Phase E — Consolidate test and harness ownership

Use one suite per shared contract, minimal per-game fixtures, automatic matrix discovery, correctly attributed results, meaningful assertions and parameterized property/model checks.

### Phase F — Falsify the framework

Use zero-game composition, independent test-only game registration, deliberate faulty consumers, missing-binding checks, game isolation and new-shared-scenario enrollment to reveal and fix hidden assumptions.

### Phase G — Enforce, measure and simplify

Add targeted architectural guards, remove redundant packages/tests/specs/compatibility paths, measure new-game onboarding cost and CI impact. Avoid unjustified API churn.

### Phase H — Verify and document

Run targeted checks during development, then the required Check PR gate and relevant Check Nightly groups using the repository's actual commands. Fix attributable failures. Update the canonical framework and game-authoring documentation.

Do not claim a check passed unless it was actually executed or validly restored as exact-input cached evidence. Report blockers and unexecuted work clearly.

---

## 16. Required final evidence

Produce a concise, factual engineering report with:

1. **Dependency proof:** framework package graph, eliminated concrete-game imports, and the successful zero-production-game build/conformance test.
2. **API map:** core contracts, capabilities, extension points, ownership, removed unnecessary APIs and remaining deliberate limitations.
3. **Anti-pattern audit:** each significant issue found, its resolution, and the automated guard that prevents recurrence.
4. **Spec ownership before/after:** Chess/Connect Four shared scenarios promoted; genuinely game-specific specs retained; regression IDs and concrete counterexamples preserved. Explain rather than hide any large game-specific corpus.
5. **Shared verification source reuse:** unique authored specifications and shared suites versus generated execution instances; duplication removed without coverage loss.
6. **Actual conformance matrix:** registered games, declared capabilities, scenario counts and execution results—not an illustrative diagram. Include any supported language/driver dimensions.
7. **Verifier sensitivity:** results from missing-binding, misattribution and deliberately faulty consumer tests.
8. **Onboarding proof:** exact files, lines or approximate size of production and fixture code needed for the test-only independent consumer; inherited workflows and tests; any framework edits required and why.
9. **Compatibility and performance:** preserved offline/realtime/history contracts, any migrations, relevant performance or CI deltas, and known limitations.
10. **Verification commands and outcomes:** distinguish targeted checks, full PR gate, nightly groups and unexecuted tests.

Avoid vanity metrics. A smaller Chess spec folder is not evidence unless its actual common guarantees moved into reusable shared sources and every compatible game now executes them.

---

## 17. Definition of done — hard gates

Do not declare completion unless all of these hold, or explicitly report the specific unsatisfied gate:

- [ ] No framework production package directly or transitively depends on a concrete game; the authorized application composition layer is the sole concrete-game registry owner.
- [ ] The framework builds and tests without any production game plugin, using a test-only consumer where needed.
- [ ] Concrete games do not depend on one another.
- [ ] No framework-owned workflow or screen has special-case logic for Chess or Connect Four.
- [ ] Shared lifecycles, experiences and state ownership each have one canonical implementation.
- [ ] Public contracts are small, opinionated, strongly typed, semantically defined and extensible to meaningfully different game shapes.
- [ ] A new game using existing capabilities needs no changes to existing games, framework internals, shared screen bodies, or shared spec/test-suite source.
- [ ] Every registered game's advertised capabilities automatically receive the complete applicable shared specification and test matrix.
- [ ] Missing or empty required matrix cells, invalid capability bindings and incorrect evidence attribution fail verification.
- [ ] Shared Gherkin, conformance suites, properties and appropriate models are genuinely game-parameterized and do not rely secretly on Chess fixtures.
- [ ] Chess and Connect Four retain all meaningful domain correctness tests and historical regression protection.
- [ ] Every semantically reusable regression protects all eligible games; the original triggering case remains reproducible.
- [ ] A new test-only consumer inherits existing shared suites and a new shared regression automatically reaches all eligible consumers.
- [ ] Conformance tests correctly detect selected intentionally faulty implementations.
- [ ] Existing package boundaries, permissions, local-first sync, authoritative room behavior, deterministic I/O, low-end mobile expectations and CI semantics remain intact.
- [ ] Known relevant architectural anti-patterns have been eliminated or clearly identified as justified exceptions with owners.
- [ ] Required verification is green, or remaining failures/blockers are accurately reported without falsely declaring success.

## Final directive

**Make the product's game framework the stable product foundation that every game can depend on with confidence.**

A framework that imports Chess is not game-independent. A reusable UI with Chess-only behavioral verification is not fully reusable. A plugin API that requires internal framework edits for every new game is not extensible. A shared conformance suite that can silently omit a registered game is not trustworthy. And an abstraction that forces Battleship or Numberlink to pretend to be Chess is not general.

Remove those failure modes at their architectural source, enforce the result mechanically, and prove the design with independent consumers and real conformance execution.

**The intended end state is one small, durable, opinionated framework API; one implementation of every shared workflow; one authoritative set of reusable, parameterized specifications and tests; and isolated game plugins that supply only their unique mechanics.**

**A new game should be a small, predictable extension to a framework that already knows how to build—and verify—a correct, consistent game experience.**
