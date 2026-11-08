# Billing improvement rounds

This is an implementation evidence log, not a production certification. The
independent baseline audit is [BILLING_BASELINE_AUDIT.md](BILLING_BASELINE_AUDIT.md).
No round has earned a 10/10 acceptance verdict.

## Round 1: optional feedback and checkout identity

Before: cancellation reasons stayed at the provider; the app had no optional
reason/comment form. Two overlapping Stripe checkout requests could create two
payable sessions. The privacy harness waited for an action that disappears after
deletion instead of the resulting task status.

After: the canceled membership offers an optional reason and comment, including
reason-only, comment-only and offline answers. A confirmed cancellation remains
eligible after its period ends, so a queued answer is not lost. Feedback is
scoped to its owner and participates in export and erasure. Stripe customer and
checkout creation use stable idempotency keys. The deletion observer reads the
persistent task status.

Evidence: cancellation feedback's 11 Gherkin scenarios passed, including the
literal offline-period-end regression; the Quint safety replay passed. The
Stripe overlap regressions passed for both new and existing customers. The
independent feedback audit rated the implementation 6/10 and identified further
reporting, rejection recovery and verification gaps.

Visual state: existing pre-change cancellation references are in
`libs/billing-client-ts/src/baselines/chromium/screens-billing/canceling-*.png`.
The actual screen stories now include optional feedback, offline saved feedback
and a failed save that preserves the answer. Local Storybook builds stalled;
this Linux ARM machine has no supported pinned Chrome build. These attempts
produced no new visual verification. Hosted screenshots remain required.

## Round 2: delivery recovery and pending payments

Before: feedback could say saved after a permanent server rejection; team access
was only a helper called by tests. Reopening the app before a paid checkout's
confirmation arrived forgot the paid-return marker and offered another checkout.

After: durable mutation feedback distinguishes pending delivery and rejection.
The rejected answer can be recovered from the device's mutation record, edited
and saved again. An operator command reads feedback in bounded pages, excluding
withdrawn answers. The paid-return marker remains in the address until membership
confirmation, so reopening that screen does not offer a second checkout.

Evidence: the pending-payment reopening scenario failed before the fix and all
9 billing-plan scenarios passed afterward. Focused billing package tests and
type checks passed; 12 focused lint/type tasks passed. The full billing suite
passed 109 tests before the new reopening scenario was added. New contract tests
cover ownership, raw query scope, guest denial, optional-field validation,
comment bounds, personal-data export/erasure, reporting pagination and recovery
copy. Full verification and hosted visual evidence remain outstanding.

## Round 3: the right membership, and a payment remembered across restarts

Before: after canceling, waiting out the period and subscribing again, the
billing screen still asked why the person canceled the old membership, beside
the new active one. A paid return was remembered only in the address and in
memory: paying, leaving the billing screen, then reopening the app forgot the
payment being confirmed and offered a second checkout.

After: cancellation feedback follows the governing membership, the same
precedence that decides what the person has. It is offered only while that
membership is the canceled one. The paid return is saved on the device for the
signed-in account, expires a day later and never applies to another account.
Until the saved return has been read back, the screen stays in its loading
state, so it never briefly offers Subscribe.

Evidence: two new regression scenarios
(`billing-feedback-offered-beside-new-membership`,
`billing-checkout-reopen-elsewhere-forgets-pending-payment`) failed on the
previous code: feedback was offered (expected false, received true), and the
"being confirmed" notice never appeared within 30 virtual seconds. Both pass
after the fix, as does reopening on the billing screen itself. A unit test
covers the saved return's account scoping and expiry; it caught an empty
record matching an empty account id before release. All 165 billing client
tests, both type checks and lint pass.

## Round 4: churn data counts only people who chose to leave

Audit of round 3: 6/10. It confirmed the round 3 fixes and found CI red (schema
snapshot not regenerated), churn data polluted by renewed memberships, and
edited feedback missed by time-bounded reports.

Before: a membership canceled and then renewed kept its cancellation date
forever. When a later payment failed and the membership ended, the person was
asked why they canceled, and the server accepted churn feedback for a
membership they had kept. Changing an answer kept its first date, so a report
for the window of the change missed it. The schema snapshot lacked the
feedback table, failing `verify:schema-evolution`.

After: the cancellation date is kept while a membership is set to end and after
a canceled one ends, and cleared on renewal. Changed feedback is dated by the
change. The branch is merged with main and the snapshot regenerated (release
21: the feedback table and `canceled_at`).

Evidence: the new scenario
(`billing-feedback-asked-after-renewed-membership-ends`) failed first
(expected false, received true) and passes now; a boundaries test failed first
(received the first answer's date) and passes now. All 113 billing scenarios,
the billing server and shared tests, the type checks and the schema evolution
check pass.

## Round 5: an older provider reading can never be what remains

Before: each provider reading (a callback, a checkout that found a paid
membership) was written as soon as it was read. Two readings committing out of
order left the older one in place: a membership that had just ended could
show as active again until the next re-check, a day or more later.

After: after writing, the app asks the provider again and writes again while
the answer differs (up to three writes). Because every writer reads after its
own last write, the last write always agrees with a reading taken after it.
Callbacks re-read through the adapter's callback reading, so a deletion
remains final. No lock is held while the provider is asked: a first version
that held a database lock during the provider call deadlocked with the
provider's webhook delivery in the full spec run (`membership-lifecycle.qnt`
trace 2), so it was replaced before commit.

Evidence: `overlapping-callbacks.test.ts` makes a second callback end the
membership and commit between the first callback's reading and its write. On
the previous code the membership stayed active; now it ends. The route matrix
pins the extra provider read. All 113 billing scenarios and model traces, the
32 billing server tests and the type check pass.

## Round 6: one payable Paddle checkout however often subscribe is pressed

Before: Paddle has no idempotency keys. Two checkouts started at the same
moment for one customer both found nothing open and both created a ready
transaction, so the person could pay twice. Only Stripe had been fixed.

After: after creating a checkout the adapter lists the customer's ready
transactions, keeps the oldest (Paddle ids sort by creation) and cancels the
rest, so every caller hands back the same checkout and only it can take a
payment. A cancel refused because the other caller already canceled it is
done; an outage, rate limit or auth failure still fails the checkout.

Evidence: a concurrency test failed first (two different checkout links) and
passes now with exactly one ready transaction. All 57 Paddle tests including
the shared provider contract, both type checks and all 113 billing scenarios
pass. Two full runs under a load average of 60 to 120 timed out on unrelated
scenarios; each of those passed when run alone and the full run passed at
normal load.

## Acceptance still required

- Provider-neutral concurrency and uncertain-outcome reconciliation, including
  Paddle and switching providers with an unfinished checkout.
- A deployed payment journey whose result actually measures the payment SLO,
  with observed production history.
- Complete funnel evidence and independent re-audit of the final revision.
- A passing full release gate and automated before/after visual evidence.
