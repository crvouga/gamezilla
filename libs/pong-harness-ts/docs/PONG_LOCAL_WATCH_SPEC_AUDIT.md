# Local Pong viewing contract

Authoring verdict: **PASS**. Implementation and current binding verification
are pending. This report supplements `PONG_LOCAL_PLAY_SPEC_AUDIT.md`; its older
execution evidence predates this model expansion.

Scope: `pong-local-watch.feature`, the complete `pong-local-play.qnt` aggregate,
and the existing Pong glossary's model references. No new term was introduced.

## Feature audit

| IDs | Evidence |
| --- | --- |
| A0–A6, D1 | Alice plays on one device; Carol joins the space, sees paddles, loses or regains a connection and cannot control another person's paddle. Pong owns the court and local play; published Games bot/game and Spaces join/space terms and the kernel connection/device terms are already borrowed. No technical mechanism or avoid-list wording appears. |
| B1–B3, B10 | The feature names watching local play, gives a situation, motivation and outcome, and puts every example inside a rule. Titles describe observable actions and outcomes. |
| B4, B8 | The first rule has joining and refused paddle-guidance examples; the refusal names ownership. The other rules explain why local play continues while viewing waits for both connections. |
| B5–B9 | Each example has one When, factual Given states and visible courts or controls as outcomes. No app copy, implementation counts, procedures or internal state are asserted. |
| B11–B13 | There is no Background. Opponent rows distinguish a person sharing Alice's device from a bot. Connection rows distinguish Alice from Carol. Each outline has two rows and all names belong to the cast. |
| B14–B17 | Existing local-game, paddle, joining and connection phrasings are reused. The lone added assertion is Alice seeing one paddle, rather than both people seeing it. Only the domain tag is used. Two recovery outlines have six steps (B16 warning); the extra precondition identifies whose connection is missing. There are no examples above eight steps. |
| P1–P2 | Spec changes are committed separately. The generated catalog remains ignored. Strict wording/ownership is checked through the package-owned gates. |

## Aggregate coverage

| Kind | Name / transition | Evidence |
| --- | --- | --- |
| command | startLocalPong, ready → playing | Existing local-start outline, person and bot while offline |
| command | joinSpace, absent → present | Both late-joining rows in the viewing feature |
| command | guidePaddle | Alice guides while either connection is missing; Carol's left/right attempts are refused |
| world event | loseConnection, connectionReturns | Existing local-play stage matrix and Alice-offline viewing/recovery rows |
| world event | viewerLosesConnection, viewerConnectionReturns | Carol-offline viewing/recovery rows |
| world event | finishLocalPong, playing → finished | Existing offline bot completion and scoring's final point |
| command | reopenApp, each stage → itself | Existing local-play and scoring reopening examples |
| invariant | invLocalAvailability | Losing either connection leaves Alice's court visible and playable |
| invariant | invLocalPaddles | Existing person/bot offline-start rows; Carol has neither paddle |
| invariant | invFinishedPaddles | Existing finished-game refusal names completion |
| invariant | invViewerPaddles | Late-joining, both takeover attempts and both recovery rows |
| invariant | invSharedCourt | Both late-joining and both returning rows |
| invariant | invOfflineCourt | Both missing-connection rows retain Carol's earlier court |
| invariant | invRefusedControl | Carol attempts each paddle and sees it remain at the middle |
| illegal command | starting after start/finish | Shared Games admission owns the modified-device refusal; existing local start availability remains unchanged |
| illegal command | Carol guides before joining | Outside this aggregate's admitted viewer; Spaces owns admission |
| illegal world events | finish outside play; lose/return unchanged connection | Model-only guards; no second world change occurs |
| published events | none | Pong declares no published event variants |
| downstream policies | borrowed Games/Spaces terms | No upstream event variants or new policies are introduced |

The model adds Carol's visible court and controls to the existing local-play
aggregate rather than a second game identity. Physical ticks, codecs, sender
fences, stream ordering and delivery errors remain code contracts.

## Handoff and evidence

`local-watch-author-gate-current.log` passes the strict spec gate. The owning
package's pure model proof is `local-watch-model-author-proof.log`. Existing
bindings still describe the previous local model; they must be updated in
implementation mode. The new viewing examples and every expanded model action
must reach the real product flow before an implementation PASS is reported.
D2–D6 are deferred for those new bindings, never claimed as already verified.
