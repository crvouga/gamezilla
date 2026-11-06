# MVP definition of done

The MVP is done when people can start using the offered product, complete
its full value loop, return to use it again, and recover from expected
problems without help from us. A collection of implemented screens or a
green subset of tests is not a finished product.

We are a solo developer team with no capacity for routine product support.
Self-service is a launch requirement, including when something goes wrong.

This document defines the launch decision, not another product specification
or a claim that the current app is ready. Product scope and behavior belong
to the [product contract inventory and specification standard](../specs/README.md).
The inventory distinguishes offered capabilities from planned additions;
MVP does not mean implementing every future idea. Every offered capability
must have a complete, verified contract.

## A complete product loop

For each offered capability, the owning Gherkin features must define what
a person can accomplish from beginning to end. Cross-feature
[critical journeys](../specs/journeys/) must prove that those pieces work
together in the actual product.

The coverage review must follow the person through these stages:

| Stage | Question the executable contract must answer |
| --- | --- |
| Arrive | Can a new person understand the offer and reach a useful starting point? |
| Begin | Can they discover an activity, understand its requirements, and start it? |
| Receive value | Can they complete the activity and clearly understand its outcome? |
| Continue | Can they choose a meaningful next action and repeat the experience? |
| Return | Can they leave, reopen, and find the progress and state the product promises to keep? |
| Recover | Can they recover from interruptions, refusals and mistakes without losing promised work or needing us? |
| Manage and leave | Can they manage identity, privacy and any paid relationship, and leave on the terms the product promises? |

Apply this review to the inventory's actual capabilities: playing and
finishing games, puzzles and progress, spaces and other people, accounts,
and payments wherever offered. Follow the existing contracts for the
precise rules. A start button without a complete ending, a result without
a next step, or an account flow that requires a developer to repair it is
an open launch gap.

## Gherkin is the acceptance contract

Business-readable Gherkin must describe the successful outcome, meaningful
alternatives, denied actions, interruptions and recovery for each loop.
Scenarios must assert visible outcomes, including saved results and what
the person can do next; merely reaching a screen does not prove completion.

Use the [specification standard](../specs/README.md) for coverage, model
exploration, bindings, audit and evidence requirements. Models and lower-level
checks strengthen the contract; they do not replace a missing product promise.
Undefined steps, incomplete bindings and missing evidence remain gaps.

“No bugs” means no known unresolved defect in an offered MVP contract,
and passing required automated evidence for the candidate release. It is
not a promise that undiscovered defects cannot exist. A known defect cannot
be relabeled as polish when it breaks the promised experience. Regression
evidence follows the [correctness policy](../README.md#correctness-machinery).

## No routine support dependency

Every person-facing loop must satisfy the existing
[self-service readiness requirements](SELF_SERVICE_READINESS.md), with
current evidence in that document's readiness matrix. That is the canonical
checklist for feedback, preserved work, safe retries, recovery and observable
failures; it is not duplicated here.

A normal user problem that needs a database edit, manual account repair,
payment reconciliation by the developer, or a private explanation blocks
MVP readiness. An error message alone does not close the gap: its next
action must lead to a verified recovery or a clear, safe terminal outcome.

Zero routine support does not mean zero operational responsibility.
Exceptional outages and security incidents still require the developer's
attention. Detection and recovery must work without waiting for a person
to report the problem, and routine operation must not depend on watching
dashboards or repairing individual users.

## Production must demonstrate the promise

Automated acceptance establishes correctness under the tested conditions.
Production Health establishes that the deployed service continues to deliver
the essential experience. Both are required for the MVP readiness claim;
neither substitutes for the other.

| Evidence | What it must establish |
| --- | --- |
| Gherkin and automated conformance | The offered behavior, complete loops and recovery paths satisfy their contracts. |
| Live critical journeys and safe synthetics | People can complete essential outcomes against the deployed product and its integrations, beyond a successful health endpoint. |
| OpenSLO objectives | Availability, success and timeliness meet their declared targets over their declared observation windows. |
| Failure detection and recovery evidence | A sustained failure is detected, diagnosed and recoverable under the existing operational policy. |

Use the [existing Health and synthetic execution policy](../README.md#correctness-machinery).
Production checks must use dedicated identities and safe cleanup; failure
paths that cannot safely run in production belong in deterministic acceptance
verification. Do not create real charges or affect real people's data to
obtain launch evidence.

Keep SLO targets, measurement sources, windows and alert rules in their
canonical OpenSLO contracts under `specs/`, rather than inventing a second
set here. Examples include [availability](../specs/runtime/availability.openslo.yaml),
[request success](../specs/runtime/request-success.openslo.yaml),
[request speed](../specs/runtime/request-speed.openslo.yaml) and
[game journeys](../specs/journeys/game-journeys.openslo.yaml).
Each essential loop needs applicable health evidence or an explicit coverage
gap. Missing telemetry, insufficient observation history and an unexecuted
check are not passing evidence. One successful synthetic run does not prove
a rolling SLO, capacity, or the absence of bugs.

## The MVP readiness decision

Declare the MVP ready only when all of the following have current evidence:

1. The canonical product inventory has no unresolved contract gaps for
   offered capabilities, and every full loop has executable acceptance coverage.
2. There are no known unresolved defects against those contracts and no
   routine task or recovery that requires product support.
3. The self-service readiness matrix has no launch-blocking limitations.
4. The candidate passes the required verification and release safeguards
   under the [CI stage policy](CI_STAGE_POLICY.md). Follow the existing
   workflow contracts; this document does not add a new CI gate or make
   nightly verification a merge prerequisite.
5. The deployed candidate has passing live journey and synthetic evidence,
   and the required production objectives meet their declared windows and
   data requirements.
6. Evidence identifies the candidate commit, deployed version, environment,
   checks and observation periods. Old results or results for another build
   cannot silently stand in for the candidate.

Record the decision with links to that evidence and any remaining gaps.
Until every condition is met, the status is **not yet MVP-ready**. A document,
feature inventory, dashboard, or passing test count alone cannot change it.
