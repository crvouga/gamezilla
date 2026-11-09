# Billing baseline audit

Independent review of commit `27bc00adc604a4323ae139076e418e77eacf07f3`,
2026-11-07. Source review and automated static verification only; no manual
testing, production payment, or visual verification was performed.

**Baseline assessment: 5/10. Not ready for a 10/10 claim.** The provider port,
two concrete adapters, recovery machinery, screen states and executable
models are substantial foundations. Missing churn evidence, concurrency
safety and truthful production acceptance prevent a higher assessment.
This is a bounded baseline review, not a claim that every possible defect
has been identified. Scores describe demonstrated implementation quality,
not a guarantee of future conversion or absence of all bugs.

## Verification actually run

- `bun run spec:verify`: passed after dependency installation, one task,
  12.073 seconds. Turbo summary:
  `.turbo/runs/3LmHXGKez2BKl6UiheTqHasviy0.json`.
- The skill's literal `bun run spec:verify --strict-duplicates` command
  passes its argument to Turbo, which rejects it. The equivalent
  `bunx turbo run ci:specs --filter=@libs/tools-harness-ts -- --strict-duplicates`
  ran the actual checker and failed on six near-duplicate pairs outside
  billing, in games, word-tiles and sokoban step definitions. Thus strict
  spec verification is **INCOMPLETE for this billing audit**, not a pass.
- No billing implementation tests, Quint replay, full `bun verify`, hosted
  health run, or production SLO query was run by this reviewer. Results
  produced by the implementation agent must be attached and reviewed
  separately.

## Findings

### B01 — P1: concurrent checkout creation can produce two payable sessions

`pkgs/billing-stripe-server-ts/src/stripe-membership.ts:126` checks existing
subscriptions and sessions, then creates a checkout without an idempotency
key. `stripe-checkout-reuse.ts:46` lists open sessions before creation.
Two requests for the same already-linked customer can both observe no
session and both create one. The route's first-customer linking protection
does not serialize this case. Paddle has the same read-before-create
structure at `pkgs/billing-paddle-shared-ts/src/paddle-membership.ts:302`.

The common contract tests sequential reuse, not overlapping creation.
Pin a controlled overlap regression, ensure at most one payable checkout
across workers and adapter instances, and test failure after remote creation
but before the response. A process-local mutex is insufficient.

### B02 — P1: switching providers can leave another payable checkout behind

`libs/billing-server-ts/src/billing-checkout-route.ts:148` checks only the
projected membership and selects the current checkout provider at line 206.
A person can have an unpaid checkout at the former provider, switch to the
new provider, and receive another payable checkout. Similarly, a payment
at the old provider awaiting its callback is invisible to the new provider's
live-membership lookup. The existing provider-switch model starts with
memberships, not unfinished checkouts.

Pin both interleavings: old checkout still open, and old payment confirmed
remotely but not projected. Switching providers must not make two
memberships chargeable. This is an existing one-membership promise, not a
new product requirement.

### B03 — P1: the payment synthetic does not measure its promised outcome

`apps/product-ts/tests/steps/billing.steps.ts:23` implements “people can pay
for Plus” by validating that any one Stripe or Paddle API credential works.
It does not exercise deployed checkout, the selected provider, the offer,
payment confirmation or paid access. An unused provider's valid key can
make this check pass while the selected checkout provider is broken.

`specs/billing/payments.openslo.yaml:10` describes successful payment and
the account showing what was purchased. `libs/observability-server-ts/src/slo-indicators.ts:404`
binds this SLI to that credential check. Consequently the SLO currently
overstates what it proves. Implement automated deployed journey evidence
with a safe, declared synthetic payment mechanism and recovery/cleanup;
keep credential readiness a separate, accurately named assertion. Read
real production outcome history before claiming the rolling SLO is met.

### B04 — P1: cancellation reasons stop at the provider

`libs/billing-shared-ts/src/plus-membership-offer.ts:75` configures reasons
in the hosted portal, and Stripe reconciliation enables its question.
But `pkgs/billing-root-shared-ts/src/membership.ts:29` has no cancellation
feedback in `MembershipChange`, the Stripe projection discards it,
`libs/billing-server-ts/src/billing-subscription-repository.ts:38` does not
persist it, and `libs/billing-shared-ts/src/telemetry.ts:25` emits only
subscription identity, status and cancellation flag.

The app cannot reliably answer why people leave independently of a vendor
dashboard. Add provider-neutral, privacy-conscious feedback capture,
durable retention and a team-readable aggregate. Cover absent/unknown
reasons, repeated callbacks, changed reasons and provider differences.
Feedback must remain optional and must never obstruct cancellation.

### B05 — P1: overlapping callbacks can overwrite a newer projection

`libs/billing-server-ts/src/billing-subscription-repository.ts:62` replaces
status, period end and cancellation state unconditionally for a live row.
Re-reading the provider avoids sequential stale payloads, but does not
prevent two handler invocations from reading A then B and committing B then
A. Stripe performs more awaited work after reading the subscription, such
as retrieving customer credit, widening that interleaving.

Add a controlled read/commit ordering regression and serialize or order
authoritative updates appropriately. Do not simply make the mapped
`ended` status permanent: Paddle pause also maps to ended and can resume.
This finding is based on the source interleaving; no failing runtime
regression was executed by this reviewer.

### B06 — P2: reloading forgets an unconfirmed paid return

`libs/billing-client-ts/src/billing-screen.tsx:89` stores the return marker
in a Solid signal and immediately removes it from the address at line 96.
`libs/billing-client-ts/src/checkout-return.tsx:25` initializes that signal
to null. Reloading before confirmation therefore loses the pending-payment
state and can offer subscribing again. “Check again” only refreshes synced
queries; it does not discover a wholly missing initial provider callback.

Pin reload while confirmation is held, sign-out/account switching, and a
lost initial callback. Preserve pending-payment recovery across restart
without leaking it to another account, and provide a bounded way to
reconcile the purchase.

### B07 — P2: conversion cannot yet be evaluated as a complete funnel

Billing's declared telemetry contains payment reconciliation and projected
membership state only (`libs/billing-shared-ts/src/telemetry.ts:39`). The
billing screen and checkout route have no corresponding declared funnel
events for viewing the offer, starting checkout, failure, return or
abandonment. Generic request traces cannot establish the full denominator
or the relationship between intent and authoritative purchase outcomes.

Define a privacy-conscious conversion measurement contract with stable
attempt correlation, bounded categories and duplicate semantics. Connect
it to authoritative purchase events and team-readable reporting. Validate
event counts and outcomes automatically; do not claim a conversion uplift
without measured evidence.

### B08 — specification audit findings and remaining coverage

- **B5 block**, `specs/billing/grace-ends.feature:50–52`: period expiry,
  signing in and viewing plans are three actions in one scenario.
- **B5 block**, `specs/billing/grace-ends.feature:59–61`: period expiry,
  signing in and eight days passing are three actions in one scenario.
- **B4 block**, `specs/billing/billing-offline-grace.feature:7`: the single
  rule has a success but no refusal or stated no-counter-example reason.
- **B4 block**, `specs/billing/billing-portal.feature:7`: the rule has only
  successful cancellation/resumption/switch examples and no explanation
  of its missing refusal side.
- **B4 block**, `specs/billing/payment-provider-switch.feature:17` and
  `:32`: the rules about continued service and new memberships provide
  successful transitions but no refusal or stated no-counter-example
  reason.

The three existing models and their bindings cover many lifecycle,
grace/refund and provider-switch paths. They do not establish the checkout
concurrency, pending cross-provider payment, churn-feedback or restart
claims above. A complete action/invariant/legal-and-illegal-transition
coverage map was not completed in this baseline; this is explicitly an
open audit item. The static normal gate passing does not waive these
judgment-based findings.

## Product opportunity, not a correctness finding

Yearly pricing is visible but cannot be selected before checkout:
`SubscribeArgs` contains only `returnUrl`, and both adapters use the offer's
default monthly key. This follows the explicit monthly-trial contract in
`specs/billing/subscribe.feature:3–5`. Direct yearly selection may improve
conversion, but changing it requires a deliberate spec change and automated
proof, not silently replacing the existing contract. Clear prices and
voluntary cancellation take precedence over coerced conversion.

## Fixed acceptance rubric for subsequent independent rounds

The overall target requires all rows to pass; no averaging hides a
payment-safety defect. A reviewer may refuse a 10 when evidence is absent.

| Area | Required evidence for full credit |
| --- | --- |
| Payment correctness | B01, B02 and B05 closed by literal regressions, persistent cross-worker coordination, provider contract tests and failure recovery; no outstanding critical/high billing findings. |
| Provider isolation | Product uses the neutral port; Stripe and Paddle satisfy the same supported behavior contract, including cancellation feedback and concurrency; vendor-specific limitations are explicit. |
| Churn understanding | Optional reasons reach durable vendor-neutral records and useful aggregate reporting; unknown/declined feedback, duplicates and privacy lifecycle are tested. |
| Conversion implementation | Offer and checkout agree, actions and disclosure are clear, the full funnel is measured correctly, and no unsupported uplift claim is made. |
| User experience and recovery | Automated mobile/desktop, keyboard, accessibility, loading/failure/offline and restart coverage; pending payment and retries are safe; readiness matrix is current. |
| Specification proof | Audited feature/model coverage map has no unexplained gaps; changed specs pass ownership and audit; relevant Gherkin/Quint/port/regression suites and full `bun verify` are green. |
| Production reliability | Hosted synthetic exercises the stated payment outcome on the deployed revision; genuine SLO observations, missing-data handling, alerting and automated cleanup are evidenced. Source declarations alone earn no production-proof credit. |
| Reviewability | Every improvement round preserves automated before/after screenshots or recordings where user-visible, red/green regression evidence where internal, rationale and a fresh independent review. |

A 10/10 review is bounded by this rubric and the reviewed revision. It is
not a mathematical proof that software can never fail or a promise that
every visitor will buy.
