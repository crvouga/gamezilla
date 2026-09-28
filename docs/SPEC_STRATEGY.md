*Executable specifications as the definition of product correctness and
production readiness*

**Core principle.** `specs/` is the implementation-independent
executable definition of the product and of the evidence required to
release it. A complete rewrite that passes is product-equivalent; a
release artifact that passes is production-ready; and every required
verdict is produced automatically with zero manual testing.

# 1. Governing Goals

These are the non-negotiable goals of the specification system. Every
design decision in this strategy is subordinate to them.

## Goal 1 --- Specs must prove the product is production-ready

> **If every required spec and automated conformance check passes for a
> release artifact, that artifact is production-ready by definition.**

A green result cannot merely mean "the tests we wrote passed." Every
required product obligation and every required class of release evidence
must have current machine-verifiable evidence. Missing, unknown,
skipped, stale, unsupported, or unexecuted obligations fail the release.

## Goal 2 --- Specs must enable a complete rewrite with an equivalent product

We must be able to delete the entire implementation and rebuild the
application from scratch using different languages, frameworks,
databases, protocols, architecture, and deployment technology while
leaving `specs/` unchanged.

> **If the rewrite passes the complete specification and conformance
> system, the rewrite is product-equivalent by definition.**

The specifications therefore describe product semantics and observable
obligations, never incidental implementation structure.

## Goal 3 --- Zero manual testing

> **A human should never manually test the application. Every check
> required for correctness, equivalence, release, or production
> readiness must be automated.**

Humans may define requirements, author specs, review changes,
investigate failures, and improve automation. Humans are never part of
the verification mechanism.

Manual QA, human sign-off, clicking through flows, visual inspection by
eye, manual smoke tests, manual accessibility checks, and manual
production verification cannot satisfy a release obligation.

For required obligations, `UNKNOWN`, `SKIPPED`, `NOT RUN`, `MANUAL`,
`UNAUTOMATED`, stale evidence, missing evidence, and missing adapters
all count as **FAIL**.

## Consequences

These goals require closed-world product conformance: a complete
inventory of product surfaces, executable obligations, automated
runners/adapters, generated negative cases, supported-environment
coverage, cross-spec consistency, live conformance where required, and
traceability from every obligation to current machine-generated
evidence.

The objective is not "high test coverage." It is:

> **Complete automated evidence that this artifact implements the
> specified product and is ready for production.**

# 2. Specification Stack

  ----------------------------------------------------------------------
  **Specification**   **Owns**                     **Primary question**
  ------------------- ---------------------------- ---------------------
  Ubiquitous language Canonical product concepts   What does this
                      and terminology              concept mean?

  Gherkin             Observable journeys and      What does an actor
                      outcomes                     observe?

  DMN                 Decisions, entitlements,     Given these facts,
                      feature gates, usage limits, what is the answer?
                      calculations                 

  Quint               State machines, concurrency, What can happen over
                      temporal properties, sync    time?
                      behavior                     

  Alloy               Structural and relational    What product
                      invariants                   worlds/snapshots are
                                                   valid?

  OpenSLO             Quantitative reliability and How well must the
                      performance objectives       product work over
                                                   time?

  Accessibility specs User-observable              Can supported users
                      accessibility requirements   operate the product
                                                   accessibly?

  Optional            Public product languages and Which external
  grammar/schema      interchange formats          inputs/formats are
                                                   valid?
  ----------------------------------------------------------------------

# 3. Repository Boundary and Flat Layout

**Admission rule.** A requirement belongs in `specs/` only if it can
remain unchanged after deleting the implementation and rebuilding the
product with a different language, database, framework, and
architecture.

The directory structure is intentionally flat. With the single
root-level exception of `conformance.yaml`, every specification lives
directly at:

``` text
specs/<bounded-context>/<some-spec>
```

There are no type-based subdirectories such as `behavior/`,
`decisions/`, `dynamics/`, `structure/`, `permissions/`, `objectives/`,
or `tests/`. The bounded context says **which part of the product owns
the truth**; the file extension says **what kind of specification it
is**.

Canonical shape:

``` text
specs/
  conformance.yaml

  membership/
    ubiquitous-language.yaml
    subscribe.feature
    cancel.feature
    permissions.dmn
    usage-limits.dmn
    membership.quint
    membership.als
    availability.openslo.yaml

  games/
    ubiquitous-language.yaml
    play-game.feature
    save-game.feature
    permissions.dmn
    usage-limits.dmn
    game.quint
    game.als
    availability.openslo.yaml

  identity/
    ubiquitous-language.yaml
    sign-up.feature
    sign-in.feature
    account.quint
    account.als
    availability.openslo.yaml

  system/
    ubiquitous-language.yaml
    purchase-membership.feature
    product.quint
    product.als
    product.openslo.yaml
```

`system` is treated like another bounded context. It owns only product
truths that genuinely span bounded contexts and should not become a
miscellaneous dumping ground.

The specification language is identified by extension:

``` text
*.feature       Gherkin: observable behavior
*.dmn           DMN: decisions, permissions, entitlements, limits
*.quint         Quint: dynamics and temporal properties
*.als           Alloy: structural/relational invariants
*.openslo.yaml  OpenSLO: quantitative quality objectives
*.ebnf          grammar, only when a public product language exists
*.schema.json   public interchange format, only when the format is product truth
```

Additional specification languages may be introduced later without
changing the directory hierarchy. A new language simply adds another
file extension under the owning bounded context.

**Flatness is a repository invariant.** Automated repository validation
must reject nested specification taxonomy directories. Apart from
`conformance.yaml`, a spec file must be directly under exactly one
bounded-context directory.

**Outside `specs/`:** database schemas, SQL queries, internal
APIs/events, JWT claims, framework code, migrations, deployment
manifests, vendor telemetry queries, test drivers,
implementation-specific fixtures, generated tests, generated conformance
vectors, and conformance adapters.

# 4. Verification Layers

## 4.1 Specification validity

-   DMN decisions are complete for their declared input space and do not
    contain unintended conflicting rules.

-   Quint invariants and temporal properties are model-checked; relevant
    actions and interleavings are explored.

-   Alloy assertions are checked within explicit scopes, and generated
    instances are reviewed for missing constraints.

-   OpenSLO objectives are well-formed and reference defined product
    indicators.

-   The conformance manifest detects missing, orphaned, or unexercised
    specifications.

## 4.2 Implementation conformance

Implementation-specific adapters translate between product concepts and
the implementation. Adapters may know TypeScript, Postgres, SQLite,
APIs, UI controls, or framework internals; specs may not.

> specification → oracle/reference evaluation → expected\
> implementation adapter → running implementation → actual\
> expected == actual

## 4.3 Assembled-system acceptance

Black-box Gherkin journeys exercise the assembled product.
Cross-bounded-context journeys verify that individually correct
components compose into the correct product.

## 4.4 Live production conformance

-   Production-safe Gherkin scenarios run as black-box synthetics.

-   Alloy-derived structural audits check live persisted state.

-   DMN decisions may be shadow-evaluated or sampled against production
    decisions.

-   Quint-derived trace/state checks validate observed lifecycle
    behavior where practical.

-   OpenSLO evaluates reliability and latency over time.

# 5. Entitlements, Permissions, and Usage Limits

**Canonical source: DMN.** The permission specification defines
Guest/Free/Plus entitlements, feature gates, per-game limits, and final
expected decisions from product facts. The implementation remains
independent and is tested against the DMN oracle.

  -----------------------------------------------------------------------
  **Tier**   **Capability**   **Game**   **Usage**     **Expected**
  ---------- ---------------- ---------- ------------- ------------------
  Guest      game.play        Trivia     below limit   ALLOW

  Guest      game.play        Trivia     at limit      DENY

  Free       game.save        \-         \-            ALLOW

  Free       game.customize   \-         \-            DENY

  Plus       game.customize   \-         \-            ALLOW

  Plus       game.play        Any        very large    ALLOW / unlimited
  -----------------------------------------------------------------------

**Generated cases.** Enumerate finite dimensions and generate boundary
representatives for numeric limits. For limit L, include 0, 1, L-1, L,
L+1, plus relevant time-window boundaries.

-   Entitlement/configuration resolution agrees with the specification.

-   Application permission decision (can(...) or equivalent) agrees with
    DMN.

-   Server enforcement: ALLOW succeeds; DENY is impossible at the real
    operation boundary.

-   Client gating is correct where feature visibility/availability is
    product behavior.

-   Denied operations produce no forbidden persistence effects.

> DMN permission case\
> ├─ expected decision\
> ├─ DB/config resolution ✓\
> ├─ application can(...) ✓\
> ├─ server operation ✓\
> ├─ client feature gate ✓\
> └─ resulting state ✓

# 6. State, Concurrency, and Local-First Sync

**Quint owns valid evolution.** It models operations, retries,
concurrency, offline edits, synchronization, conflict handling, and
temporal guarantees without encoding Postgres, SQLite, networking, or
sync implementation.

-   Usage cannot exceed a product limit through concurrent operations.

-   Retrying an acknowledged operation cannot create a duplicate product
    effect.

-   Finished games cannot return to active states unless explicitly
    allowed.

-   Acknowledged durable actions are not silently lost.

-   Offline/server changes follow defined conflict semantics.

-   When synchronization quiesces, server and clients eventually
    converge where convergence is promised.

# 7. Structural Invariants: Postgres and SQLite

**Alloy owns valid snapshots.** Alloy describes product relationships,
cardinalities, reachability, uniqueness, containment, and other
structural invariants. It does not know database tables.

> domain.als\
> product invariants\
> │\
> ┌──────────┴──────────┐\
> ▼ ▼\
> Postgres adapter SQLite adapter\
> │ │\
> ▼ ▼\
> server snapshot client snapshot\
> └──── valid product world? ────┘

-   Every game has exactly one owner.

-   A game's owner is also a participant.

-   A user has at most one mutually exclusive active membership where
    required.

-   Containment relationships cannot contain cycles.

-   Entitlements and usage records reference valid product concepts.

-   Every persisted Postgres or SQLite snapshot represents a legal
    product world.

**Production scaling.** Small/test snapshots may be projected into an
Alloy-compatible model. Large production datasets should be audited
through implementation-specific queries/evaluators derived from the
invariant semantics. Generated SQL is adapter code, never product
specification.

# 8. Behavioral Acceptance and Synthetics

**Gherkin owns observable behavior.** Do not duplicate DMN decision
matrices or Quint invariants as hundreds of scenarios. Gherkin focuses
on meaningful actor journeys, outcomes, failures, and cross-context
behavior.

> @production-safe\
> Scenario: Guest can start an available game\
> Given I am a guest with remaining game usage\
> When I start an available game\
> Then the game starts successfully

Selected production-safe scenarios are reused as synthetic checks in CI,
staging, and production through environment-specific adapters.

# 9. Reliability and Performance

**OpenSLO owns quantitative objectives.** State product-level success
and latency objectives without embedding Prometheus, Datadog,
cloud-provider, or other observability implementation queries.

-   Availability/success-rate objectives for critical journeys.

-   Latency objectives for user-observable operations.

-   Rolling windows and error budgets where these are product
    requirements.

-   Synthetics and telemetry adapters provide measurements used to
    evaluate objectives.

# 10. Accessibility, Security, Privacy, Recovery, and Time

  ----------------------------------------------------------------------
  **Concern**           **Typical      **Examples**
                        mechanism**    
  --------------------- -------------- ---------------------------------
  Accessibility         ACT/WCAG +     Keyboard operation, focus
                        Gherkin        behavior, accessible names

  Security properties   DMN + Quint +  Denied capabilities remain
                        adversarial    impossible; cross-user private
                        Gherkin        data is not observable

  Privacy               Quint +        Deletion/export/retention
                        Gherkin        lifecycle

  Recovery/durability   Quint +        Acknowledged operations survive
                        Gherkin        failures; retries are idempotent

  Time semantics        DMN + Quint    Usage-window reset boundaries,
                                       expiration, exact boundary
                                       behavior
  ----------------------------------------------------------------------

# 11. Closed-World Completeness

**Mandatory for the production-readiness claim.** The verifier must
prove not only that known specs pass, but that required product concepts
have not escaped specification.

-   Every product capability is declared in the product/conformance
    manifest.

-   Every permission-bearing capability has a complete decision
    specification.

-   Every declared permission has required enforcement adapters.

-   Every public product operation is traceable to its relevant
    capability, journey, or model.

-   Every required spec file has an active runner.

-   Unknown, skipped, missing, unimplemented, or unverified required
    coverage fails conformance.

-   Adding a new capability without updating required specs causes CI to
    fail.

# 12. Conformance Manifest

A root manifest defines which dimensions are mandatory and prevents
accidental removal of a verifier from producing a false green build.

> product:\
> contexts: \[identity, games, membership\]\
> tiers: \[guest, free, plus\]
>
> conformance:\
> behavior: required\
> decisions: required\
> dynamics: required\
> structure: required\
> accessibility: required\
> objectives: required
>
> production_readiness:\
> require:\
> - specification-validity\
> - implementation-conformance\
> - permission-enforcement\
> - assembled-system-acceptance\
> - production-safe-synthetics\
> - required-quality-gates

# 13. Pipeline

> product verify
>
> 1.  SPECIFICATION\
>     vocabulary / manifest PASS\
>     DMN completeness & consistency PASS\
>     Quint model checking PASS\
>     Alloy model checking PASS
>
> 2.  IMPLEMENTATION\
>     generated decision conformance PASS\
>     permission enforcement PASS\
>     model-based / trace conformance PASS\
>     Postgres structural conformance PASS\
>     SQLite structural conformance PASS\
>     accessibility conformance PASS
>
> 3.  SYSTEM\
>     Gherkin acceptance journeys PASS\
>     cross-context journeys PASS\
>     global invariants PASS
>
> 4.  RELEASE / LIVE\
>     production-safe synthetics PASS\
>     required live-state audits PASS\
>     OpenSLO readiness policy PASS
>
> 5.  COMPLETENESS\
>     declared capabilities 100%\
>     permission coverage 100%\
>     required adapters 100%\
>     required conformance checks 100%
>
> PRODUCT CONFORMANCE: PASS\
> PRODUCTION READINESS: PASS

# 14. What 'Production Ready' Means

**Definition.** A candidate is production-ready when every required
specification is valid, every required implementation and
assembled-system conformance check passes, required completeness is
100%, and all release-time quality gates defined by the conformance
manifest are satisfied.

**Important limitation.** This definition is only as complete as the
product specification and the closed-world rules that require coverage.
Unforeseen platform/runtime vulnerabilities and implementation-specific
engineering hazards still require release engineering controls; those
controls may be mandatory gates without becoming product semantics.

**Operational principle.** There is no silent 'unknown'. For a required
dimension, PASS requires evidence; absence of evidence is FAIL.

# 15. Strong Equivalence Requirements

For this strategy, passing means more than "the tests we happened to
write are green." The specification must define the complete observable
equivalence boundary.

Two implementations are product-equivalent when no actor or supported
environment represented by the specification can distinguish them except
where the specification explicitly permits variation.

The following are therefore required whenever they are part of the
product:

-   public API, CLI, webhook, deep-link, import/export, plugin, or other
    externally promised contracts;
-   supported client/server version combinations and compatibility
    promises;
-   data export/import and user-owned artifact round trips;
-   supported browsers, operating systems, device classes, locales,
    timezones, and offline/online modes;
-   exact time-window, expiration, timezone, numeric precision, currency
    rounding, ordering, tie-breaking, Unicode, and locale semantics when
    observable;
-   deterministic behavior or explicitly allowed
    nondeterminism/randomness;
-   failure, retry, cancellation, timeout, recovery, durability, and
    graceful-degradation semantics;
-   privacy, deletion, retention, tenant isolation, and cross-user
    confidentiality properties;
-   accessibility behavior;
-   quantitative reliability, latency, freshness, and capacity promises.

Internal representation remains irrelevant.

# 16. Allowed Nondeterminism

A rewrite must not be rejected merely because it chooses a different
result where the product intentionally permits several results.
Conversely, unspecified nondeterminism must not become an accidental
escape hatch.

For every observable nondeterministic behavior, specify one of:

-   the exact allowed set of outcomes;
-   an ordering/tie-breaking constraint;
-   an invariant all outcomes must satisfy;
-   a statistical/distributional requirement;
-   an explicit statement that the value/order is unspecified and
    therefore outside equivalence.

This applies to random games, recommendations, generated content,
concurrency races whose winner is intentionally unspecified, ordering of
equivalent results, and timing ranges.

# 17. Public Contracts and Data Portability

If a contract is promised to an external consumer, it is product truth
even when expressed using a technical protocol.

Specify and verify as applicable:

-   public APIs and protocols;
-   public events/webhooks;
-   CLI behavior;
-   stable URLs/deep links;
-   import/export formats;
-   extension/plugin contracts;
-   supported compatibility/version promises.

If users can create durable artifacts, verify export completeness,
import validity, round-trip semantics where promised,
ownership/visibility preservation, and absence of silent corruption or
loss.

Internal APIs, internal events, database schemas, and migration
mechanics remain outside `specs/`.

# 18. Supported Environment Matrix

The conformance manifest must define where the equivalence claim
applies.

Examples include:

-   supported browser policy;
-   supported native OS versions;
-   device classes where behavior materially differs;
-   offline and online operation;
-   supported client/server version skew;
-   locales and timezones;
-   accessibility modes.

Every declared environment must run the applicable conformance suite.
Unsupported environments are explicitly outside the product contract
rather than silently untested.

# 19. Cross-Spec Consistency

Multiple DSLs describe one product. Their claims must not contradict
each other.

The verifier should detect contradictions such as:

-   DMN denies an action that Gherkin requires to succeed under
    identical facts;
-   Quint admits a state Alloy declares structurally impossible;
-   a Gherkin journey depends on a capability absent from the manifest;
-   OpenSLO measures an operation not present in the product inventory;
-   the same ubiquitous-language term is given incompatible meanings.

Use stable canonical identifiers across specifications so these checks
can be automated.

# 20. Test-Oracle Independence

For strong conformance, the reference specification implementation and
the product implementation should be independent.

For example, DMN may compute the expected permission result while the
TypeScript/Rust application implements permissions separately. If
production simply executes generated code from the same DMN, comparing
that code back to the DMN tests the generator/integration, not an
independent implementation.

Generated implementations are allowed, but the strength and purpose of
that check must be explicit.

# 21. Validate the Conformance System Itself

A green suite is meaningful only if it detects realistic violations.

Regularly run mutation/fault-seeding experiments against disposable
builds:

-   invert a permission;
-   change a usage-limit boundary;
-   remove server enforcement;
-   break client gating;
-   violate an Alloy invariant;
-   alter a Quint transition;
-   break sync conflict handling;
-   corrupt a public output;
-   introduce latency/error degradation.

The appropriate conformance check must fail. Mutation machinery is test
infrastructure and remains outside `specs/`.

# 22. Release Engineering Gates

Some production-readiness requirements are implementation-specific and
therefore cannot honestly be product semantics, but **must still be
required by the conformance manifest** for the statement "ready for
production."

Examples:

-   dependency/vulnerability policy;
-   secrets/configuration validation;
-   build/release artifact integrity;
-   required backup/restore verification;
-   deployment rollback/recovery verification;
-   platform-specific security hardening;
-   required operational observability;
-   schema/migration safety checks for the chosen implementation.

The manifest defines that these evidence classes are mandatory; their
implementation-specific checks live outside `specs/`.

This preserves the boundary:

> `specs/` defines the product and the evidence required to call an
> implementation production-ready. Implementation-specific tooling
> supplies that evidence.

# 23. Closed-World Closure Rules

The following rules are non-negotiable for the "full stop" equivalence
claim:

1.  Every externally meaningful capability is declared.
2.  Every declared capability has all applicable behavioral, decision,
    state, structural, quality, security, privacy, accessibility, and
    compatibility obligations linked to it.
3.  Every required obligation has a runner and an implementation adapter
    where necessary.
4.  Every supported environment executes the applicable obligations.
5.  Every public contract is inventoried and verified.
6.  Every required negative/forbidden behavior is tested at the real
    enforcement boundary.
7.  Every required result is PASS; `unknown`, `skipped`, `not run`,
    missing, stale, or unsupported evidence is FAIL.
8.  Adding implementation-visible product surface without adding it to
    the manifest is a build failure.
9.  Removing a spec runner or adapter without removing the corresponding
    product obligation is a build failure.
10. The repository validator enforces
    `specs/<bounded-context>/<some-spec>` and rejects nested type-based
    spec directories.
11. The conformance report records the exact spec revision,
    implementation artifact, environment, and evidence used for the
    verdict.

# 24. Final Production-Readiness Definition

A specific release artifact is **equivalent and production-ready** when:

-   the specification is valid and internally consistent;
-   the closed-world inventory is complete;
-   all applicable executable product specs pass against that artifact;
-   all supported environment/platform matrices pass;
-   all permissions and negative cases are enforced at actual product
    boundaries;
-   all state, concurrency, recovery, local-first, and structural
    properties pass;
-   all public contracts and data-portability promises pass;
-   all accessibility, security, privacy, and quality obligations pass;
-   all required implementation-specific release-engineering evidence
    passes;
-   all required live/release-environment checks pass;
-   there are no unknown, skipped, missing, stale, or unverified
    required obligations.

Under those rules:

> **`PRODUCT CONFORMANCE: PASS` is the definition of "this rewrite is
> product-equivalent and ready for production."**

The remaining limitation is logical rather than procedural: no finite
specification can guarantee that humans have imagined every requirement
or every future vulnerability. The closed-world inventory, cross-spec
consistency checks, mutation testing, and mandatory release evidence
exist to make omissions detectable rather than silently green.

# 25. Zero Manual Testing Policy

**Manual testing is prohibited as a source of product-conformance or
production-readiness evidence. A human should never need to manually
test the application.**

Every test, check, audit, inspection, acceptance criterion, release
gate, and production-readiness obligation must be executable
automatically and produce machine-verifiable evidence.

This applies to all layers of the product:

-   user journeys and acceptance behavior;
-   permissions, entitlements, feature gates, and usage limits;
-   client behavior and UI state;
-   server enforcement;
-   Postgres and local SQLite state;
-   local-first synchronization and conflict behavior;
-   accessibility;
-   public contracts and compatibility;
-   import/export and data portability;
-   security and privacy properties;
-   failure, retry, recovery, and durability behavior;
-   performance, reliability, capacity, and SLOs;
-   supported browsers, native platforms, locales, timezones, and other
    declared environments;
-   deployment/release checks and live production conformance.

Humans may author specifications, review product requirements,
investigate failures, and improve automation. Humans must **not** be
required to click through flows, visually inspect screens, run ad hoc
scenarios, compare outputs by eye, or sign off that behavior "looks
correct" in order for a release to pass.

The rule is:

> **If a property matters enough to affect product equivalence or
> production readiness, it must be specified and automatically
> verifiable.**

If a requirement currently appears to require manual testing, that is
treated as an automation gap. The release does not receive credit for
the requirement until an automated verifier exists.

Examples:

-   Instead of manually checking whether a button is hidden, query/drive
    the rendered client and assert the observable UI state
    automatically.
-   Instead of manually testing keyboard navigation, automate focus
    traversal and accessibility assertions.
-   Instead of visually checking layouts, use automated semantic,
    geometry, screenshot/differential, or other machine-verifiable
    checks where layout is product-significant.
-   Instead of manually exercising a permission, generate the case from
    DMN and execute the real operation automatically.
-   Instead of manually inspecting production data, run Alloy-derived
    invariant audits automatically.
-   Instead of manually checking offline synchronization, generate and
    execute Quint-derived traces automatically.
-   Instead of manually smoke-testing production, run production-safe
    Gherkin synthetics automatically.
-   Instead of manually deciding whether latency is acceptable, evaluate
    OpenSLO objectives automatically.

## 25.1 No Human Sign-Off Escape Hatch

The conformance system must not contain statuses such as:

``` text
manual verification required
QA sign-off required
visually verified
tested by hand
works on my machine
approved after exploratory testing
```

for any required production-readiness obligation.

A required obligation may resolve only to machine-evidenced states such
as:

``` text
PASS
FAIL
```

`UNKNOWN`, `SKIPPED`, `NOT RUN`, `UNAUTOMATED`, `MANUAL`, stale
evidence, or missing evidence are all treated as **FAIL** for production
readiness.

## 25.2 Exploratory Work Does Not Count as Testing Evidence

Humans can explore the product while designing features or investigating
defects, but exploratory interaction is not part of the verification
strategy and can never satisfy a release gate.

Any defect discovered manually must result in an automated regression
specification/test before it is considered permanently covered. The
long-term artifact is the executable specification or automated
conformance check, not the human reproduction procedure.

## 25.3 Automation Completeness Is Itself a Gate

The conformance manifest must require automation coverage for every
mandatory obligation.

Conceptually:

``` yaml
production_readiness:
  manual_testing_allowed: false

  require:
    - automated-specification-validity
    - automated-implementation-conformance
    - automated-permission-enforcement
    - automated-system-acceptance
    - automated-accessibility-conformance
    - automated-security-and-privacy-properties
    - automated-release-environment-conformance
    - automated-production-synthetics
    - automated-live-state-audits
    - automated-quality-objectives

  fail_on:
    - manual
    - unknown
    - skipped
    - not-run
    - missing-evidence
    - stale-evidence
    - missing-automation
```

The verifier must fail when a new capability, environment, or
requirement is introduced without an automated way to verify its
applicable obligations.

## 25.4 Consequence for the Equivalence Claim

The final standard is therefore stronger:

> **A rewrite is product-equivalent and production-ready only when the
> complete, closed-world specification suite and every required release
> gate pass automatically, with zero manual testing or human
> verification required.**

A human may decide *what the product should mean*. A human may inspect
why automation failed. But a human is never part of the mechanism that
determines whether the implementation conforms.

The production-readiness verdict must be reproducible from source
specifications, the release artifact, declared environments, and
machine-generated evidence alone.
