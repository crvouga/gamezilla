# Overnight Mission: Specify and Build Chess Custom Games Completely

## Mission

Build **Custom Games for Chess** as a complete, production-ready
capability. Treat this as a **closed-world specification +
implementation + conformance project**, not a feature ticket.

Work autonomously for the entire run. **Do not ask me questions. Do not
stop at first green. Do not leave TODOs, placeholders, skipped
obligations, knowingly incomplete state spaces, or manual
verification.** Continue discovery, specification, model checking,
implementation, auditing, adversarial testing, and refinement until
repeated completeness passes find no meaningful omissions and every
required gate passes.

Resolve ambiguity from: existing ubiquitous/published language; existing
Chess specs; cross-context specs/product conventions; existing
implementation only as evidence of prior intent; then the simplest
internally consistent behavior a reasonable chess player would expect.
Encode every product-significant decision in executable specs, never
only in code.

## Product direction

Replace separate underlying concepts such as **play friend**, **play
bot**, and **bot vs bot** with one abstraction: **Custom Game**.

> One chess game model. White and Black are configurable participants.
> Common game types are configurations, not separate domain systems.

The model should naturally represent, where valid: Alice vs Bob, Alice
vs bot, bot vs Alice, bot vs bot, Alice vs an open place, and a
non-playing creator/host if deliberately supported. These are examples,
not the specification. Discover the complete behavior.

Common configurations must remain extremely easy. UX presets may exist
but must resolve into the same Custom Game semantics. Do not create
separate `FriendGame`, `BotGame`, etc.

## Governing specification strategy

Read `specs/README.md` completely first and obey it.

-   **Ubiquitous language** --- canonical product concepts.
-   **Gherkin** --- observable rules, outcomes, refusals, journeys.
-   **Quint** --- state evolution, arbitrary histories, concurrency,
    offline behavior, temporal properties, invariants.
-   **DMN** --- permissions, entitlements, gates, limits, complete
    decisions.
-   **Alloy** --- structural/cardinality/relational legal worlds.
-   **OpenSLO** --- quantitative user-observable reliability/latency.
-   **Journeys** --- critical cross-context flows.
-   **Conformance** --- closed-world inventory and required automated
    evidence.

> **Gherkin explains the rules to a person. Quint proves those rules
> survive arbitrary valid histories and interleavings.**

Do not explode combinations into hundreds of Gherkin scenarios. Do not
leave state-machine semantics represented only by a few examples.

# Phase 0 --- Reconnaissance

Inspect `specs/README.md`, `conformance.yaml`, shared and Chess
ubiquitous language, every Chess feature/model/DMN/Alloy/OpenSLO/events
file, relevant journeys, published language from
Spaces/Friends/Identity/Billing/Matchmaking/Runtime, current
Chess/game/bot implementation,
clocks/rating/history/review/watch/rematch/offline behavior, harness
actions/reads, steps, Quint bindings, catalogs, and `spec-upsert`,
`spec-audit`, `spec-implement`.

Inventory what is already product truth, what Custom Games
generalizes/replaces, what belongs to another context, what assumptions
exist only in code, and what capabilities/decisions must enter
conformance. Existing implementation is not automatically truth.

# Phase 1 --- Discover the complete product

Before implementation, inventory every meaningful state, command, world
event, outcome, refusal, legal/illegal transition, repeated action,
race, offline/reconnect case, permission, cross-context policy,
structural invariant, temporal invariant, and intentional
nondeterminism.

## Participants and configuration

Explore creator/other person/friend/bot/open place as White or Black;
bot-vs-bot; both sides open if sensible; whether creator must play;
non-playing creator; same person on both sides; identical/distinct bots;
assign/remove/replace participants; person↔bot↔open changes; color
choice/swap/random color if supported; eligibility;
acceptance/readiness; creator authority distinct from participation.

Audit standard chess and supported variants; starting/custom position if
supported; side to move and position rights when relevant;
timed/untimed; initial time/increment/delay; ratedness;
privacy/visibility; invitation/open participation; watching; bot
strength/personality if already a product concept; pre-start mutability;
post-start immutability; rematch/new-game inheritance. Do not cargo-cult
features from other chess products.

## Lifecycle

Discover creation → configuration → participant acquisition/readiness →
start → active/completed, plus cancellation/abandonment where
appropriate.

For **every lifecycle status × every command**, classify: legal
transition, legal idempotent/no-op, observable refusal,
unavailable/hidden, or impossible for a person to express. No accidental
undefined cells.

## Invitations, bots, play, completion

Explore invite, accept, decline, revoke/change, claim/release open
place, leave/rejoin, full/started/completed/cancelled games,
authorization, blocking policy if relevant, privacy, concurrent claims,
accept-vs-revoke, stale availability, creator/invitee disappearance.

Bots are first-class participants. Cover person↔bot, bot↔bot,
configuration, replacement, turn ownership, clocks, terminal states,
watching bot-vs-bot, cancellation, and intentional move nondeterminism.
Engine/search/infrastructure internals stay out of specs.

Compose with existing Chess truths: turns, legal/illegal moves, check,
checkmate, stalemate, draws, resignation, timeout, clocks, completion,
history, review, watching, rematch, rating, reconnect. Refactor/reuse
existing models rather than duplicating chess rules.

If non-playing creators are supported, specify
configuration/start/cancel authority, departure, continuation after
start, and watcher behavior. If forbidden, make that explicit product
truth.

## Offline, concurrency, repetition

Explore observable behavior during configuration, invite, join/claim,
readiness, start, play, completion. Include stale views, offline edits
vs remote changes, stale starts, reconnect after start/completion,
acknowledged action then disconnect, multiple devices if supported, and
promised convergence after quiescence.

At minimum explore races: two people claim one place; accept vs revoke;
join vs cancel/start; leave vs start; configuration change vs start;
open→bot vs claim; color swap vs participant replacement; duplicate
start/join/leave/cancel; concurrent edits; stale reconnect; move vs
resign; move/checkmate vs timeout; bot move vs terminal state.

Do not arbitrarily choose race winners. For intentional nondeterminism
specify the allowed outcome set and invariants common to all outcomes.

For every expressible command define repeated-after-acknowledgement
behavior. Repetition must not duplicate product effects.

Aggressively try to construct invalid worlds: missing sides at start;
illegal dual control; contradictory roles; \>1 occupant per side;
open+occupied side; bot config on human; post-start configuration
mutation; join after start/completion; start twice; move before
start/wrong side; bot acting for human; completed/cancelled game
resurrecting; dangling invitations; impossible creator/participant
relationships; contradictory readiness; every pathological Alloy
instance.

# Phase 2 --- Ubiquitous language

Audit the Chess glossary first. Prefer existing terms. Add only
necessary concepts with plain definitions, forms, avoided synonyms,
Quint model names, and publication only where another context genuinely
needs them. Borrow foreign concepts only through published language. No
technical vocabulary or accidental synonyms.

# Phase 3 --- Gherkin: complete readable behavioral contract

**Gherkin is a primary deliverable.** Build a business-rule inventory
before writing scenarios.

At minimum cover rules for: create; configure White/Black; assign
person/bot/open place; remove/replace/swap participants; game options;
invite/accept/decline/revoke; claim/release; readiness and loss of
readiness; becoming startable; start; invalid-start refusal; post-start
immutability; creator/player/watcher authority; cancellation;
join/leave/rejoin; bot participation; bot-vs-bot; offline/reconnect
outcomes; meaningful race outcomes; completion; post-completion
restrictions; rematch/new game; permissions; cross-context policies;
accessibility-significant behavior; privacy/isolation. This is a floor,
not a ceiling.

## Every Rule proves both sides

For every `Rule:`:

-   state exactly one business rule in ubiquitous language;
-   include a meaningful positive scenario;
-   include the strongest meaningful counterexample/refusal;
-   if no person can break it, use the standard's explicit
    no-counter-example justification;
-   choose boundary cases most likely to reveal a defect;
-   reuse existing step wording.

## Mandatory Gherkin coverage

-   Every Quint command gets a meaningful happy path unless legitimately
    model-only.
-   Every person-observable invariant is illustrated by the attempt most
    likely to violate it.
-   Every meaningful legal lifecycle transition is illustrated.
-   Every excluded state where a person can still express the command
    gets a refusal/unavailable scenario.
-   Every required domain event is shown happening.
-   Every relevant upstream policy gets a downstream reaction scenario.

Strictly enforce repository rules: correct `@domain`; capability title;
required job story; every scenario under `Rule:`; exactly one `When`;
Given=fact; When=one command/event; Then=observable; no UI
mechanics/implementation vocabulary/hidden narrator; named actors;
unique outcome-oriented titles; brief scenarios; correct Background use;
outlines only for true business dimensions/boundaries; no giant tables;
no duplicate/near-duplicate phrasings; no exact UI copy; no internal
assertions.

Do **not** write one Gherkin scenario per state-space combination.
Gherkin remains the readable product contract; exhaustive combinations
belong in Quint/DMN/Alloy/property checks.

## Mandatory Gherkin adversarial audit

Repeatedly ask:

-   Which command lacks a happy path?
-   Which observable invariant lacks an attempted violation?
-   Which legal transition is absent?
-   Which illegal transition can a person attempt but lacks a refusal?
-   Which rule shows only success?
-   Which upstream policy lacks a reaction?
-   Which domain event is never shown?
-   Which behavior is merely implied?
-   Which scenario belongs in Quint/DMN/property testing instead?
-   Which vocabulary escaped the glossary?
-   Which wording duplicates an existing step?
-   What would a reasonable chess player expect but cannot find?

Do not finish with unexplained `MISSING` coverage.

# Phase 4 --- Quint: exhaustive state-space model

**Quint is the center of the completeness effort.** Build a real
aggregate model, not a decorative mirror of Gherkin.

## Observable state and actions

Model product-significant state as applicable: lifecycle; creator/host;
White/Black assignment; participant kind; invitation/open-place state;
readiness; immutable starting configuration; clock configuration; bot
configuration; started/completed/outcome state where owned here;
per-person observable state where offline divergence matters; connection
state required by the offline-first profile.

Every observable variable must participate in meaningful invariants.

Model every person-expressible Custom Game command:
assign/remove/replace person; assign/remove/configure bot; open/close
place; invite/accept/decline/revoke; claim/release; swap/change colors;
configure options; start; cancel; leave; and relevant
reconnect/offline/completion actions. Compose/refactor existing Chess
models instead of duplicating move-level rules.

## Strong invariants

Derive and model at minimum:

-   White and Black assignments are always valid.
-   Side relationships never contradict participant rules.
-   An open side is not simultaneously occupied.
-   A side has at most one controller.
-   Forbidden dual-side control is impossible.
-   Bots/people act only for their assigned side.
-   Start requires a complete playable configuration.
-   Start occurs at most once.
-   Starting configuration is immutable after start.
-   Completed/cancelled states cannot illegally reactivate.
-   One open place cannot be won by two people.
-   Revoked invitations cannot grant participation unless recreated.
-   Repeated acknowledged commands cannot duplicate effects.
-   Terminal games reject further play.
-   Authority cannot be bypassed.
-   Offline behavior preserves promised guarantees.
-   Acknowledged durable actions are not silently lost.
-   Promised convergence occurs after reconnect/quiescence.
-   Nondeterministic outcomes remain inside the explicitly allowed set.
-   No reachable state violates structural product truths.

No trivial invariants. Increase verification depth/bounds when defaults
cannot reach important histories.

## Mandatory transition matrix

Construct and audit:

`lifecycle status × command → transition | idempotent/no-op | refusal | unavailable`

Prove every legal transition reachable and every person-attemptable
illegal transition defined. Cross-check against Gherkin.

## Mandatory participant matrix

Systematically enumerate finite `White kind × Black kind` combinations
actually supported, plus creator participation/authority dimensions.
Prove validity/refusal rules exhaustively in model/property machinery.
Gherkin keeps representative examples.

## Mandatory race matrix

Enumerate command pairs that can overlap in the same reachable state.
For each pair determine whether they commute, one wins
deterministically, either ordering is allowed within an invariant-safe
outcome set, or one becomes refused. Model-check dangerous pairs.

## Deep histories and conformance

Ensure traces reach histories such as
configure→invite→replace→claim→leave→reconfigure→start; offline→remote
change→local attempt→reconnect; repeated commands; participant churn;
configuration/start races; terminal-boundary races.

Bindings must drive the real product through the approved harness and
observe it after every step. Every bound action must be reached.
Product/model disagreement means fix the product unless the model is
demonstrably wrong, in which case return through the spec-writing
workflow rather than silently weakening it.

# Phase 5 --- DMN

Inventory every affected permission-bearing capability: create,
configure, invite, join/claim, watch, start, cancel, configure bots, and
membership-specific customization.

Use complete UNIQUE-hit tables with declared input domains. Cover
numeric boundaries automatically. Verify every applicable enforcement
layer: application decision, real operation boundary, client gate.
Denied operations produce no forbidden effect. Do not duplicate decision
matrices in Gherkin.

# Phase 6 --- Alloy

Model timeless legal Custom Game worlds: game↔creator, game↔White/Black,
participant/color cardinalities, invitations/open places, bot
relationships if durable concepts, uniqueness, ownership/participation
constraints, and every other structural truth discovered.

No time/state-machine logic. Include assertions/checks and at least one
legal world. Aggressively inspect generated instances for
underconstraint. Add constraints for every product-invalid world Alloy
can still construct. Validate required real snapshots through adapters.

# Phase 7 --- OpenSLO, journeys, accessibility, privacy

Add/update OpenSLO only for genuine product-level Custom Game
success/latency promises. Add critical cross-context journeys without
duplicating Chess coverage. Ensure accessibility behavior is
automatically verifiable. Specify cross-user confidentiality/visibility
for private, invited, and open games where applicable.

# Phase 8 --- Closed-world completeness audit before implementation

Produce coverage maps for every affected aggregate. Account for every
command, observable invariant, domain event, legal transition,
person-attemptable illegal transition, upstream policy, permission
capability, structural invariant, meaningful nondeterministic outcome,
relevant supported environment, and externally observable Custom Game
operation.

No unexplained `MISSING`. Model-only rows require explicit
justification.

Run repeated adversarial passes:

-   What can happen before, during, and after start?
-   What can happen twice?
-   What can happen concurrently?
-   What can happen offline and after reconnect?
-   What happens at every lifecycle boundary?
-   What happens after every terminal state?
-   What changes if creator is not a player?
-   Have all participant configurations been explored?
-   What assumption exists only in code?
-   What invalid world can Alloy still construct?
-   What undesirable trace can Quint still produce?
-   What implementation-visible behavior is absent from conformance?

Only when repeated passes stop finding meaningful gaps is the spec phase
complete. Commit specification changes according to the repository's
`spec:` ownership rules.

# Phase 9 --- Prove red

Run every new/changed obligation against the pre-feature product and
observe meaningful red. Compile/setup/unrelated failures do not count.
Do not implement behavior until its specification demonstrates that it
can fail for the right reason.

# Phase 10 --- Implement one coherent system

Implement against the completed specs. Generalize existing Chess
concepts instead of parallel systems. A bot, person, or open place is
participant configuration. Presets are UX shortcuts over the same
semantics.

Keep step definitions/bindings thin. Keep product logic out of tests.
Bind only through the approved harness. Preserve unrelated behavior.

## UX principle

The primary mental model should be obvious: **White vs Black**.
`You vs Friend` and `You vs Bot` should require minimal effort.
Bot-vs-bot, open places, non-playing host, and advanced settings should
emerge through progressive disclosure, not separate modes. Accessibility
is correctness.

# Phase 11 --- Post-implementation adversarial loop

A passing first implementation is the midpoint, not the end.

Repeat until stable:

1.  run spec audit and coverage maps;
2.  inspect Quint traces and unreachable actions;
3.  increase model-check bounds where necessary;
4.  inspect Alloy instances for unintended worlds;
5.  inspect DMN completeness/conflicts/boundaries;
6.  search Gherkin for missing refusals/transitions and duplicate
    wording;
7.  seed realistic defects where practical and verify the correct layer
    catches them;
8.  search implementation for Custom Game behavior absent from
    specs/conformance;
9.  search specs for obligations not actually exercised by bindings;
10. run full conformance/gates;
11. fix gaps and repeat.

Try mutations such as: allow same person both sides; permit start with
open side; permit post-start configuration; let two people win one
place; allow duplicate start; let bot move wrong side; resurrect
completed game; bypass permission; lose an acknowledged change after
reconnect. The intended verification layer must fail.

# Phase 12 --- Required final verification

Run all applicable repository checks, including at minimum:

-   `bun run spec:check --strict-duplicates`;
-   affected domain spec suites;
-   Quint trace/model conformance;
-   Apalache/model checking;
-   DMN completeness/consistency/generated enforcement cases;
-   Alloy checks and snapshot conformance;
-   Gherkin acceptance;
-   accessibility conformance;
-   relevant journeys;
-   conformance manifest checks;
-   `bun run spec:ownership`;
-   `bun run spec:catalog`;
-   full `bun check`;
-   every other required release/conformance gate affected by the
    change.

No skipped, unknown, stale, unbound, unsupported, or manually verified
required obligation is acceptable.

# Definition of Done

Do **not** stop merely because the UI works or tests are green.

Stop only when all are true:

-   Custom Games are one coherent chess-game abstraction, not parallel
    friend/bot modes.
-   Ubiquitous language fully defines the concepts.
-   Gherkin provides complete readable business-rule coverage and both
    sides of each rule.
-   Quint models the complete meaningful lifecycle, actions, offline
    behavior, races, retries, and temporal invariants.
-   Transition, participant, and race matrices have no unexplained
    holes.
-   DMN completely specifies affected permissions/entitlements.
-   Alloy rejects every discovered illegal structural world and admits
    valid worlds.
-   Critical journeys, accessibility, privacy, and quality obligations
    are covered where applicable.
-   Every required spec has a working runner/binding and current
    evidence.
-   Model checking reaches meaningful actions and sufficiently deep
    histories.
-   Multiple adversarial completeness passes stop finding meaningful
    omissions.
-   Mutation/fault-seeding shows realistic violations are caught by the
    intended layer.
-   Full conformance and repository gates pass.
-   There is no manual testing requirement.
-   There is no `UNKNOWN`, `SKIPPED`, `NOT RUN`, missing, stale, or
    unsupported required evidence.

## Final instruction

**Keep working overnight until this definition of done is satisfied. Do
not ask for clarification or stop to report intermediate uncertainty.
Investigate, decide from the product's existing language and rules,
specify the decision, prove the specification, implement it, audit it,
and continue until the Custom Games capability is complete.**
