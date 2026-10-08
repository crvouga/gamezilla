# Known behavior and evidence issues

No application runtime was manually tested. No historical known-bug entry is presumed open merely because its regression file exists.

<a id="ki-001"></a>
## KI-001 — The next-puzzle journey changes the product during its outcome check

**Owners:** Chess and Journeys. **Evidence:** [critical journey](../../specs/journeys/critical-journeys.feature), [outcome step binding](../../libs/runtime-harness/src/journeys.steps.ts#L159), [helper that presses Next](../../libs/runtime-harness/src/puzzle-gestures.ts#L73), [auto-advance off by default](../../libs/chess-puzzle-client/src/use-puzzle-auto-advance.ts#L9).

The outcome helper performs an additional user action. It cannot establish that the preceding solve alone displayed a next puzzle. The chart keeps the promised next-puzzle outcome and marks it assumed pending the owners’ decision; it does not model the hidden check action as intended behavior. Affected states have `meta.knownIssue` referring here. This static evidence establishes a mismatch in the acceptance proof; it does not establish which product behavior should change. No failing application input or runtime regression is claimed.

## Unverified areas are questions

Billing grace, refund and account-deletion reactions are intended outcomes drawn from specs. Context-model coverage gaps and unbound mid-flow reactions are in [SPEC_CONFLICTS.md](SPEC_CONFLICTS.md) and [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md), rather than being mislabeled confirmed runtime defects. Existing repository regression records remain the historical bug register.
