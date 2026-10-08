# Source disagreements

This report separates incompatible definitions from limited model scope and from missing execution evidence. No source was silently rewritten.

## Product / architecture owners

### Context partition

The [context map](../../specs/README.md#context-map) names 14 contexts and omits Chessboard and Whole product. [conformance.yaml](../../specs/conformance.yaml) lists Chessboard as its own context, while [the system glossary](../../specs/system/ubiquitous-language.yml) names Whole product. The atlas retains the map, places board projections under Chess provisionally, and links system models as cross-product constraints. Product and architecture must decide which partition is authoritative. Affected: all `contexts/chess/*/board-*` projections and atlas-level journeys. No new boundary was invented.

### Atlas placement and naming

The review-only atlas lives under `docs/statecharts/`, outside the flat business contexts in `specs/`, and its Markdown filenames follow the repository naming rule. It documents the specifications without becoming a new product context or release gate.

## Billing owner

<a id="billing-grace-model"></a>
### Membership model scope versus the access contract

[membership-lifecycle.qnt](../../specs/billing/membership-lifecycle.qnt) explicitly keeps grace from expiring, so every existing membership grants paid access in that model. [grace-ends.feature](../../specs/billing/grace-ends.feature) requires free access after eight days; [refunds.feature](../../specs/billing/refunds.feature) ends access immediately. [system/membership-machine.qnt](../../specs/system/membership-machine.qnt) and [membership precedence](../../pkgs/billing-root-shared/src/precedence.ts) do represent expiration/refunds. The continuous flow follows Gherkin and the system interpretation; the sampled context lifecycle preserves the limited model and does not invent a Quint expiration action. Billing must decide how the context model is extended. Affected: `membership-and-checkout` grace/refund states and `membership-lifecycle` ended states. This is a context model coverage gap, not proof of a runtime billing bug.

At the exact grace deadline, both the system model and implementation still grant access (`now <= deadline`); the first later millisecond ends it. Gherkin’s six/eight-day examples do not settle that boundary. Named “grace expires” events mean the first instant after the deadline, not early expiration at the seventh-day instant.

### Offer naming

The feature language calls the paid offer Plus; [the provider offer](../../libs/billing-shared/src/plus-membership-offer.ts) uses `Unlimited` and `Gamezilla Unlimited`. Billing/product must confirm the customer-visible checkout and portal naming. Monetary figures in the current model and offer agree at USD 7 monthly / USD 60 yearly; regional offers remain execution seed variants, not new plan tiers.

## Chess owner and Journeys owner

### A next-puzzle action hidden inside an outcome

[critical-journeys.feature](../../specs/journeys/critical-journeys.feature) says a guest solves a puzzle and then the next puzzle is ready, without a move-on action or auto-advance preference. [puzzle-attempt-resume.feature](../../specs/chess/puzzle-attempt-resume.feature) distinguishes explicit move-on from configured auto-advance. [the code](../../libs/chess-puzzle-client/src/use-puzzle-auto-advance.ts) defaults auto-advance off. [expectNextPuzzleReady](../../libs/runtime-harness/src/puzzle-gestures.ts#L73) presses Next inside the outcome check. The critical journey therefore proves a different interaction from its wording. The atlas preserves both versions as assumed intent and flags [KI-001](KNOWN_ISSUES.md#ki-001). Decide whether the critical journey promises an automatically displayed next puzzle or a ready-to-choose next puzzle. Affected: critical journey next-puzzle outcome and puzzle solving results.

### Sample coverage is not lifecycle completeness

All public Custom Game choices now have successful action witnesses, including draw acceptance/decline and invitation decline/revocation from the additional seed-43 campaign. Successful samples still do not settle every actor, side, invitation and connection combination. Product and engineering must reconcile those parameter classes to the configuring/active projection before claiming complete coverage.

## Friends owner

### Declined-request waiting period has no expiration action

[friendship.qnt](../../specs/friends/friendship.qnt) describes a one-day waiting period after decline but never advances that period or clears its `declined` set. The flow’s refusal example is mapped; the end-of-wait transition cannot be derived from this model. The [contract inventory](../../specs/README.md#product-contract-inventory) also records this gap. Friends must specify the reopening event and exact time boundary. Affected: friendship lifecycle’s stranger-after-decline states.
