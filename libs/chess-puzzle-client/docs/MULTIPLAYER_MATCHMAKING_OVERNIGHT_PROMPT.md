# Overnight Mission: Specify and Build Multiplayer Matchmaking Completely

## Mission

Build **multiplayer matchmaking** as a complete, production-ready
capability using and improving **`pkgs/matchmaking`**. Treat this as a
closed-world specification + reusable-package + implementation +
conformance project.

Work autonomously. **Do not ask questions. Do not stop at first green.
Do not leave TODOs, skipped obligations, incomplete state spaces, or
manual verification.** Continue until repeated adversarial completeness
passes find no meaningful omissions and all required gates pass.

Resolve ambiguity from ubiquitous/published language, existing
Matchmaking specs, game/cross-context specs, established conventions,
then existing code only as evidence of prior intent. Encode every
product decision in executable specs.

## Architecture

Use, audit, and improve `pkgs/matchmaking`. **Do not bypass it with
game-specific matchmaking.** Keep it game-agnostic wherever semantics
are genuinely reusable. Matchmaking owns reusable search lifecycle,
compatibility mechanics, pairing, cancellation, races,
retries/idempotence, and observable recovery. Consuming games supply
game-specific facts/policy and consume the resulting match.

Do not contaminate the package with Chess concepts merely to ease the
first integration. Do not over-generalize speculative features either.

> Reusable matchmaking owns matchmaking semantics. Games supply
> facts/policies and own game creation semantics that are not generic
> matchmaking truths.

## Specification strategy

Read `specs/README.md` completely first. Preserve its ownership: -
Ubiquitous language: canonical concepts. - Gherkin: observable
rules/outcomes/refusals. - Quint: state evolution, arbitrary histories,
concurrency, offline/reconnect, temporal invariants. - DMN:
permissions/entitlements/limits. - Alloy: structural legal worlds. -
OpenSLO: quantitative product reliability/latency. - Journeys: critical
cross-context flows. - Conformance: closed-world automated evidence.

> **Gherkin explains matchmaking rules to a person. Quint proves them
> under arbitrary histories and interleavings.**

# Phase 0 --- Reconnaissance

Inspect `specs/README.md`, conformance, shared/Matchmaking language, all
`specs/matchmaking/**`, relevant
game/Chess/Spaces/Friends/Identity/Billing/Runtime/Journeys specs, and
**all of `pkgs/matchmaking`** including public API, consumers, harness,
tests, adapters, search/rating/pairing/cancellation logic and state
assumptions. Read step catalogs and spec skills.

Inventory: current package guarantees; which are specified; behavior
existing only in code; generic vs game-specific behavior; accidental
Chess coupling; premature generalization; required conformance changes;
and existing specs needing expansion. Do not rewrite the package merely
for aesthetics.

# Phase 1 --- Discover the complete product

Before implementation inventory every meaningful state, command, world
event, outcome, refusal, transition, retry, race, temporal boundary,
offline/reconnect case, permission, policy, invariant, and intentional
nondeterminism.

## Search lifecycle

Explore not-searching → begin → waiting → compatible → matched, plus
stop/cancel, restart, match handoff, disconnect/reconnect and observable
recovery. For **every status × command** classify:
`legal transition | idempotent/no-op | refusal | unavailable | impossible to express`.
No undefined cells.

## Search identity/exclusivity

Specify whether active search uniqueness is per
person/account/game/device/pool; duplicate begins; multiple devices;
replacing searches; concurrent different searches; already-matched
search attempts; when someone may search again. Forbidden
duplicate/contradictory search worlds must be impossible.

## Compatibility

Discover every relevant fact: pool/game configuration, rating/range,
search age, party/team size if supported, blocked relationships if
relevant, membership/eligibility, and other genuine product constraints.
Separate generic mechanics from game-specific policy. `pkgs/matchmaking`
must not need Chess concepts where generic compatibility facts suffice.

## Rating/range evolution

If ranges widen, specify initial range, widening, exact boundaries,
maximum, mutual compatibility semantics, asymmetric ranges, reset
behavior, stop/restart, and time passage. Exhaust numeric boundaries in
models/properties/decisions, not giant Gherkin tables.

## Match formation

Specify when seekers cease being available; atomic product-level
formation; no person/search in two matches; participants agree on the
same match; eligibility at the defined decision point;
cancellation/eligibility-change races; duplicate formation; retries;
partial formation; downstream handoff and ownership of the resulting
match.

## Candidate selection/fairness

If multiple compatible candidates exist, specify only genuine product
guarantees: nearest rating, oldest search, tie-breaking,
starvation/eventual opportunity, or intentionally unspecified choice.
Never accidentally specify an implementation algorithm. Explicitly
define allowed nondeterministic outcomes.

## Scope

Inspect whether the reusable package deliberately supports 1v1 only or
N-player/team matching. Do not invent unsupported scope, but do not
unnecessarily bake Chess assumptions into reusable abstractions.

## Cancellation and changing eligibility

Explore stop while waiting, at compatibility, during formation, after
match, repeated stop, stop→immediate new search, another device,
offline, and stale cancellation after a newer search. **A stale command
must never affect the wrong logical search.** Specify behavior when
rating, membership, block relationship, game availability, or other
eligibility changes while searching.

## Offline/reconnect and retries

Explore disconnect while waiting; match while disconnected; cancellation
while disconnected; another-device status; reconnect after match/cancel;
stale local waiting state; acknowledged commands followed by disconnect;
convergence. For every command define retry behavior. Retries must never
create duplicate searches/matches/participants, cancel the wrong search,
or resurrect terminal state.

# Phase 2 --- Ubiquitous language and package boundary

Audit Matchmaking vocabulary first. Prefer existing terms. Add only
necessary plain product concepts with forms, avoids, model names, and
publication where needed.

Keep Matchmaking language generic. Audit `pkgs/matchmaking` so reusable
matchmaking mechanics live there and game-specific facts/policy stay
with consumers. There must not be a second matchmaking algorithm in
game/application code. Improve the package API when the completed
specification demonstrates its current interface forces bypass/coupling;
otherwise avoid speculative redesign.

# Phase 3 --- Gherkin: complete readable contract

**Gherkin is a primary deliverable.** Build a business-rule inventory
before implementation.

At minimum cover: begin search; observe active search; active-search
exclusivity; stop; restart; compatible seekers match; incompatible
seekers never match; rating/range boundaries; range evolution;
formation; both participants observe same match; person appears in at
most one match; cancel-vs-match; repeated begin/stop; reconnect while
waiting; match while disconnected; reconnect after match; eligibility
changes; multiple devices; observable selection/fairness; downstream
game handoff; permissions; policies; privacy; accessibility.

This is a floor, not a ceiling.

For every `Rule:` include one business rule, a meaningful positive
scenario, strongest meaningful counterexample/refusal, explicit
no-counterexample justification only when valid, and boundary cases
likely to expose bugs.

Mandatory coverage: - Every person-expressible Quint command has a happy
path unless model-only. - Every observable invariant has the strongest
attempted violation. - Every meaningful legal transition is
illustrated. - Every person-attemptable illegal transition has
refusal/unavailable behavior. - Every required domain event is shown. -
Every relevant upstream policy has a reaction.

Strictly obey repository Gherkin rules: correct domain tag, capability
title/job story, every scenario under Rule, exactly one When,
declarative Given, one command/event in When, observable Then, no
implementation/UI mechanics, named actors, brief unique outcome
scenarios, correct Background/Outline use, no duplicate wording/internal
state.

Do not encode candidate permutations, numeric matrices, or concurrency
state space as Gherkin.

Repeatedly audit: missing happy paths, invariant violations,
legal/illegal transitions, exact cancellation/match boundary, rules
showing only success, implied behavior, scenarios belonging in
Quint/DMN, escaped vocabulary, and reasonable multiplayer expectations
not specified. No unexplained `MISSING`.

# Phase 4 --- Quint: exhaustive matchmaking state space

**Quint is the center of this project. Matchmaking correctness is
primarily concurrency/state-machine correctness.**

## State/actions

Model product-significant search status, logical search identity where
needed, pool/configuration facts, rating/compatibility, search
age/range, eligibility, formed matches, participants, handoff status if
owned here, per-device observable state where offline divergence
matters, and required connection state.

Model begin, stop, relevant time passage, eligibility/compatibility
changes, connection loss/restoration, match formation, handoff event if
applicable, and all discovered person-expressible actions. No
queues/locks/rows/workers/messages in the app model.

## Strong invariants

Prove at minimum: - active searches never exceed the product limit; -
one logical search cannot produce multiple matches; - one person cannot
enter incompatible simultaneous matches; - every match has the required
distinct eligible participants; - participants are mutually compatible
by specified policy; - participants agree on the same match; - matched
searches cannot be reused; - cancelled searches cannot later match
unless a new search exists; - stale cancellation cannot cancel a newer
search; - repeated begin/stop cannot duplicate effects; - formation is
atomic at product level; - forbidden partial matches are never
observable; - eligibility holds at the specified decision point; -
rating/range boundaries are respected; - widening follows specified
monotonic/max rules; - terminal searches cannot illegally reactivate; -
acknowledged durable actions are not silently lost; - promised reconnect
convergence occurs; - candidate nondeterminism remains within allowed
outcomes; - reachable state never violates Alloy structural truths.

No trivial invariants.

## Mandatory matrices

Construct and exhaustively audit:

`search status × command → transition | idempotent/no-op | refusal | unavailable`

Construct a compatibility matrix over finite dimensions plus numeric
boundary representatives. Prove compatible candidates may match and
incompatible candidates never match, with deliberate symmetry/asymmetry.

Construct a **race matrix** covering at minimum: begin/begin; begin from
two devices; begin/stop; stop/match; two match attempts sharing a
person; A↔B vs A↔C; eligibility change/match; widening/match;
disconnect/match; reconnect/cancel; stale stop/new begin;
handoff/cancel; formation retries. Classify
commute/winner/allowed-outcome/refusal semantics.

The model must prove **exactly-once logical match assignment**, not
merely make duplicates unlikely.

## 3+ seeker requirement

Do not model only Alice and Bob. Explore Alice compatible with Bob and
Carol; Bob also compatible with Dave; simultaneous compatible
candidates; cancellation during competing formation; new candidates
arriving while older candidates wait. Many real matchmaking races
require at least three seekers.

## Deep histories

Reach histories such as begin→widen→candidate
arrives→leaves→widen→match; begin→disconnect→remote match→reconnect;
begin→stop→begin again→stale stop; multi-device duplicate begin→match;
several compatible seekers→competing formation→single safe outcome.

Increase verification bounds when defaults cannot reach these histories.
Ensure every bound action is reached.

Bindings drive the real product through the approved harness and observe
after every step. Correct model vs product disagreement means fix
product; ambiguous/wrong model returns through spec workflow, never
silent weakening.

# Phase 5 --- DMN

Inventory every affected capability: begin matchmaking, stop, enter
specific pools/modes, match eligibility, membership-gated matchmaking
features, and other permission-bearing operations. Use complete
UNIQUE-hit tables with declared domains and generated numeric
boundaries. Verify application decision, real operation boundary, and
client gate where applicable. Denied operations produce no forbidden
effects. Do not duplicate matrices in Gherkin.

# Phase 6 --- Alloy

Model timeless legal worlds: person↔active search cardinality;
search↔person ownership; match↔participant cardinality; distinct
participants; search↔match uniqueness; no search/person attached to
contradictory matches; pool/configuration relationships; other
discovered structural truths.

No temporal logic. Include assertions/checks and a legal instance.
Aggressively inspect generated worlds for underconstraint and constrain
every product-invalid world discovered. Validate required real snapshots
through adapters.

# Phase 7 --- OpenSLO, journeys, privacy, accessibility

Add/update product-level objectives only for genuine promises such as
successful search operations, match formation reliability, or
user-noticeable latency where the product defines them. Do not encode
infrastructure metrics. Add critical end-to-end journeys from
matchmaking into the resulting multiplayer game without duplicating
Matchmaking specs. Automatically verify accessibility. Specify
isolation/privacy so one seeker cannot observe another's private search
facts beyond deliberately exposed behavior.

# Phase 8 --- `pkgs/matchmaking` reusable-package audit

After specifications are complete but before broad implementation,
compare the package against them.

Check: - public API expresses required generic commands/facts cleanly; -
consumers do not reimplement pairing; - package does not know
Chess-specific concepts unnecessarily; - logical search identity
prevents stale-command corruption where required; - concurrency
guarantees are enforceable at the real operation boundary; - retries are
safe; - package can be deterministically driven by the harness/model; -
observable state can be read without leaking internals; - package
remains reusable for another compatible multiplayer game.

Refactor/improve the package where required. Preserve useful existing
behavior that does not conflict with product truth.

# Phase 9 --- Closed-world completeness audit before implementation

Produce coverage maps accounting for every command, observable
invariant, domain event, legal transition, person-attemptable illegal
transition, policy, permission, structural invariant, nondeterministic
outcome, environment, and observable matchmaking operation.

No unexplained `MISSING`; model-only requires justification.

Repeatedly ask: - What happens before/during/after formation? - What can
happen twice? - What can happen concurrently? - What requires three or
more seekers to expose? - What happens from multiple devices? - What
happens offline/reconnecting? - What happens exactly at range
boundaries? - What happens when eligibility changes? - Can any stale
action affect a newer search? - Can anyone enter two matches? - Can one
search create two matches? - Can cancellation and formation produce a
contradictory world? - Can Quint produce an undesirable trace? - Can
Alloy construct an invalid world? - Does game code implement matchmaking
behavior absent from `pkgs/matchmaking` or specs? - Does the reusable
package contain product behavior absent from specs?

Only when repeated passes stop finding meaningful gaps is specification
complete. Commit specs according to `spec:` ownership rules.

# Phase 10 --- Prove red

Run every new/changed obligation against the pre-feature product and
observe meaningful red. Compile/setup/unrelated failures do not count.
New product behavior must prove it can fail before implementation.

# Phase 11 --- Implement

Implement against the completed specs using and improving
`pkgs/matchmaking`. Do not add a competing game-specific matcher.

Keep bindings/steps thin and product logic out of tests. Bind through
approved harness boundaries. Preserve unrelated behavior.

The consuming multiplayer game should integrate through the reusable
Matchmaking contract and consume a successful match without duplicating
search/pairing semantics.

# Phase 12 --- Post-implementation adversarial loop

A passing first implementation is the midpoint.

Repeat until stable: 1. run spec audit/coverage maps; 2. inspect Quint
traces/unreachable actions; 3. increase model-check depth; 4. inspect 3+
seeker contention traces; 5. inspect Alloy instances; 6. inspect DMN
completeness/boundaries; 7. search Gherkin for missing
refusals/transitions/duplicate wording; 8. search consumers for bypasses
of `pkgs/matchmaking`; 9. search package behavior absent from specs; 10.
seed realistic defects and prove intended checks fail; 11. run full
conformance; 12. fix and repeat.

Mutation/fault seeds should include: - allow two active searches when
forbidden; - let one search form two matches; - let one person enter two
matches; - match incompatible ratings; - violate exact range boundary; -
let stale stop cancel a newer search; - let cancelled search later
match; - lose acknowledged cancellation; - duplicate begin on retry; -
expose partial match; - allow A↔B and A↔C concurrently; - fail
convergence after reconnect; - bypass permission; - move pairing logic
into a consumer and bypass reusable semantics.

The appropriate verification layer must fail.

# Phase 13 --- Final verification

Run all applicable checks, including at minimum: -
`bun run spec:check --strict-duplicates`; - Matchmaking domain specs; -
affected consuming-game specs; - Quint trace/model conformance; -
Apalache/model checking with sufficient depth; - DMN
completeness/consistency/enforcement; - Alloy checks/snapshot
conformance; - Gherkin acceptance; - relevant journeys; -
accessibility; - conformance manifest; - `bun run spec:ownership`; -
`bun run spec:catalog`; - full `bun check-pr`; - every affected
release/conformance gate.

No skipped, unknown, stale, unbound, unsupported, or manually verified
required obligation is acceptable.

# Definition of Done

Stop only when: - multiplayer matchmaking uses `pkgs/matchmaking` as the
reusable source of matchmaking mechanics; - consumers do not maintain
competing matchmaking logic; - package remains game-agnostic where
semantics are generic; - ubiquitous language completely defines product
concepts; - Gherkin provides complete readable business-rule coverage
with both sides of each rule; - Quint thoroughly explores lifecycle,
compatibility, time, retries, offline/reconnect, multi-device behavior,
3+ seeker contention, and races; - status, compatibility, and race
matrices have no unexplained holes; - exactly-once logical match
assignment is model-checked; - stale commands cannot corrupt newer
searches; - duplicate searches/matches/participants are impossible where
forbidden; - cancellation/match races are deliberately specified; - DMN
fully specifies affected permissions; - Alloy rejects discovered illegal
worlds and admits legal ones; - package implementation conforms to the
model through the harness; - critical downstream multiplayer journey
works through the reusable contract; - multiple adversarial audits stop
finding meaningful omissions; - mutation/fault seeding demonstrates
realistic violations are caught; - all conformance/repository gates
pass; - zero manual testing is required; - there is no `UNKNOWN`,
`SKIPPED`, `NOT RUN`, missing, stale, or unsupported required evidence.

## Final instruction

**Keep working overnight until this definition of done is satisfied. Do
not ask for clarification or stop to report uncertainty. Investigate,
decide from the existing product language and rules, specify the
decision, prove the specification, improve `pkgs/matchmaking` as
required, implement the integration, audit it adversarially, and
continue until multiplayer matchmaking is complete.**
