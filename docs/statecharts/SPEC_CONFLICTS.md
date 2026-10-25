# Source disagreements and contract gaps

The charts preserve the current specifications and identify unresolved distinctions. They do not change product behavior or assert that an application defect was reproduced.

## The next puzzle (existing review reference KI-001)

[The critical journey](../../specs/journeys/critical-journeys.feature) says a guest solves a puzzle and the next puzzle is ready. [Resuming attempts](../../specs/games/puzzle-attempt-resume.feature) distinguishes moving on from configured auto-advance. The chart keeps the solved state, the explicit move-on event and the configured auto-advance event. The guided journey uses explicit move-on. Whether the critical journey’s “ready” means displayed or available to choose remains unresolved.

## Membership grace and refunds

[The membership lifecycle](../../specs/billing/membership-lifecycle.qnt) does not expire grace or include a refund action. [Grace ending](../../specs/billing/grace-ends.feature), [refunds](../../specs/billing/refunds.feature) and [the system membership machine](../../specs/system/membership-machine.qnt) describe those outcomes. The chart includes their visible outcomes and references both scopes. Its expiry event means after the deadline, following the system interpretation’s inclusive deadline.

## Feed customization

[The feed access feature](../../specs/games/puzzle-feed-gates.feature) requires an account. The `customize` branch in [the whole-product interpretation](../../specs/system/product-state.qnt) also requires paid access. The feed chart presents the feature’s account invitation and identifies this disagreement. It does not resolve the discrepancy by changing a permission rule.

## A declined friend request

[The friendship model](../../specs/friends/friendship.qnt) names a one-day wait after a decline but has no action clearing that wait. The chart retains the waiting and refusal states. Returning to the people list remains available; no invented expiration event is presented as a model-supported transition.

## Hearts and finding an opponent

[A game's choices](../../specs/games/game-choices.feature) says every game offers custom games, finding an opponent and its history. [Playing Hearts with people and bots](../../specs/hearts/hearts-custom-games.feature) says Hearts is played in custom games only and nobody is paired up for it. The chart follows the Hearts contract: its Hearts choices offer a custom game, review and the way back to the game choice, with no way to find an opponent, and do not cite the game's choices feature. Which of the two contracts is narrowed remains unresolved.

## Stand-ins and a participant without a connection

[A stand-in for someone away](../../specs/games/multi-seat-stand-ins.feature) says that in every custom game with more than two sides, a participant away for 60 seconds is played by a stand-in while another person is in the game and the host is here. [Games with more than two sides](../../specs/games/multi-seat-games.feature) says a participant without a connection keeps their side and turn, and that losing a connection alone is never a move. The implementation follows the stand-in contract for every such game, King of the Hill included: an offline participant keeps the turn for 60 seconds, then a disclosed stand-in moves. The stand-in specification is bound only for games with secret choices, so King of the Hill's stand-ins are held by code tests (`libs/game-session-shared-ts/tests/stand-ins.test.ts`), not by its scenarios. Whether the multi-seat rule means "never at once" or "never" remains unresolved.

## Source scope

The [context map](../../specs/README.md#context-map) groups product Chess and independently scoped framework contracts. [Conformance](../../specs/conformance.yaml) and the [whole-product glossary](../../specs/system/ubiquitous-language.yml) also name Chessboard and Whole product. The product chart composes their existing contracts for exploration without declaring new bounded contexts. The [product contract inventory](../../specs/README.md#product-contract-inventory) remains the list of behavior that still needs definition or automated evidence, including inbox coverage and additional puzzle modes.

A source link is traceability, not proof that every scenario or parameter combination is represented by a separate graph edge. Rule checks retain boundaries and constraints that do not require a new visible state. The referenced Quint, DMN, Alloy and objective contracts remain responsible for their respective obligations.
