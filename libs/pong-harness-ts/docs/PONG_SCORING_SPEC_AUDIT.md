# Pong scoring spec audit

Verdict: **PASS** for the scoring contract. It has no remaining wording or
coverage finding in this review. Its eight scenarios and the scoring model
now pass through the actual product harness. The strict repository gate and
spec ownership check pass after the wording cleanup described below. This
verdict covers scoring, not the unfinished Pong implementation.

Scope: `specs/pong/pong-scoring.feature`, `pong-scoring.qnt`, the Pong glossary
and its context-map entries in `specs/README.md`.

## Feature verifications

| Verification | Evidence |
| --- | --- |
| A0, A5, D1 | The feature describes a countdown, a ball passing a paddle, points, victory and reopening the app. No transport, storage, code, UI procedure or sub-second timing appears. |
| A1, A2 | Pong, court, paddle, ball, point, score, target score, countdown, serve, in play, victory and local play resolve in the Pong glossary. The app and connection are kernel terms. Game is borrowed from Games. No avoid-list synonym is used. |
| A3 | The task brief supplies Pong, court, paddles, ball, scoring, score target, countdown, serves and local play. Existing vocabulary supplies game, victory, time passing, the app and connection. No new product surface or role is coined. |
| A4 | Games publishes game. The context map declares Games → Pong for that term. Pong publishes only its name; it imports no other context's model. |
| A6 | Alice, Bob, the ball and the countdown are the actors or observable events. |
| B1, B2 | The title names scoring and finishing. The description is one job story. |
| B3, B4 | Every example belongs to a Rule. Countdown, point awards and reopening give explicit no-counter-example reasons. Victory has a final-point example and a finished-score refusal to change. |
| B5–B10 | Every example has one When, factual Givens and visible Thens. Titles state outcomes. Quoted app copy and implementation instructions are absent. |
| B11 | The one Background fact assigns the two people to their paddles on one device; every example uses that same game. |
| B12, B13 | One outline varies the paddle passed, with two rows. One varies the visible stage on reopening, with three rows. The cast and scores are plausible. |
| B14 | The existing “Alice closes and reopens the app” wording is reused. Pong-specific scoring and countdown phrases have no existing equivalent in the generated catalogs. Global strict collisions remain below. |
| B15, B16 | Only `@domain:pong` is used. Every expanded scenario has five steps including the Background. |
| B17 | Outcomes are visible scores, a serve, victory, the ball stopping and local play surviving reopening. Numerical collision and serialization cases remain code tests. |

## Coverage: pong-scoring.qnt

| Kind | Model name | Term | Illustrated by | Status |
| --- | --- | --- | --- | --- |
| world event | countdownEnds | countdown | The first serve begins with both scores at zero | covered |
| world event | pointWon | ball, point | Both rows of the paddle-passing outline | covered |
| world event | waitAfterFinish | seconds pass | Time passing cannot add a point to a finished Pong game | covered |
| command | reopenApp | the app | All three rows of reopening local Pong | covered |
| invariant | invScores | score, target score | The point-award rows and the final-point example | covered |
| invariant | invVictory | victory | The final point awards the victory; time passing keeps the result | covered |
| invariant | invFinishedScore | score | Finished time passing and reopening finished Pong | covered |
| invariant | invReopening | local play | Reopening during countdown, play and after victory | covered |
| transition | countdown → playing | countdown | The first serve | covered |
| transition | playing → countdown | point | The non-final point rows explicitly show the next countdown | covered |
| transition | playing → finished | victory | The final point | covered |
| transition | finished → finished | seconds pass | Time passing after victory | covered |
| transition | each visible stage → itself | the app | The three reopening rows | covered |
| illegal world event | countdownEnds outside countdown | countdown | A countdown cannot end when none is shown; this is a world-event guard, not a person-attempted command | model-only |
| illegal world event | pointWon outside play | point | No travelling ball can pass a paddle during countdown or after victory; the world-event guard excludes it | model-only |
| domain events | none | — | No events are published | not applicable |
| policy | Games → Pong | game | The scenarios concern one game; Games publishes no events | covered |
| unmapped When | none | — | Every When maps to one of the four actions above | covered |

The model follows short games to one or two points. It is a scoring projection,
not a second physics implementation. Paddle geometry, ball integration,
floating-point behavior, input ordering and snapshot protocols stay in their
code-level verifications.

## Steps and process

One opener uses `gameSystem` with the actual Pong shared/client registrations.
Both entry points discover their modules and use that opener. Steps call public
harness actions and visible reads only. The one-device lineup has one account
and an explicit second local person. Scoring actions guide the rendered paddles;
they never inject a board or an expected result. Scores, court geometry and
stages come from the rendered board. The ball-stopped assertion observes its
position without acting. Only injected virtual time passes.

The binding names all four public model actions plus `init`, and observes
`score`, `targetScore`, `stage` and `winner` through the same visible reads.
Bookkeeping variables stay in the model. The PR profile replays one twelve-step
trace drawn from sixteen candidates, sufficient to take every bound action.
All sixteen candidate traces also passed through the product with
`QUINT_REPLAY_TRACES=all`; evidence is `/tmp/pong-scoring-all-traces.log`.
No assertion recomputes Pong physics or chooses a result from product state.

The executable run of all eight examples failed on the undefined Background
step, with no compilation, import or setup failure. Evidence:
`/tmp/pong-scoring-red.log`. The whole current Pong context then passed thirteen
checks, including all eight expanded scenarios and a model replay:
`/tmp/pong-scoring-context.log`. Two equivalent score assertions were unified
under the already catalogued “score is still” wording; their claims did not
change. The spec commit contains only `specs/**` and this report; step bindings
and product changes belong to implementation commits.

## Strict gate wording cleanup

The strict preflight (`/tmp/pong-spec-preflight.log`) reports thirteen pairs:

- Custom Game/custom game casing across Battleship, Chess, Games and Runtime:
  starting, readiness, nobody winning, winning on time, already started and
  resigning.
- Battleship's “own board is unchanged” versus Chess/Games board wording.
- Friends' “in their own space” versus “in the space”.
- Games' first move “again on her other device” versus “on her other device”.

These findings are resolved with their meanings preserved. Chess and journey
specs use the shared lowercase custom-game vocabulary. Battleship explicitly
keeps every ship in place on the own board. The return-to-space assertion names
the space the person hosts. The second-device action explicitly repeats the
already played first move. Existing step bodies are unchanged; their expressions
were rebound to the clarified wording. No model, action, invariant or example
was removed, and all earlier coverage relationships remain.

The current strict run is green: `/tmp/pong-wording-strict.log`. Ownership is
green in `/tmp/pong-spec-ownership.log`. The Battleship and space-return examples
failed on the new undefined wording, then passed after rebinding
(`/tmp/pong-wording-red.log`, `/tmp/pong-wording-green.log`). All twenty-one
affected chess examples and forty matched-game examples passed in
`/tmp/pong-wording-context.log`. The five affected harness packages passed all
ten type-check and lint tasks in `/tmp/pong-wording-quality.log`. The live
journey's casing is mechanically rebound; no production Health run is claimed.

## Remaining scope

This is only the scoring aggregate. Controls, collisions, bots, configuration,
local start, shared lifecycle, matchmaking, spectators and recovery still need
their product contracts and conformance. This report claims neither complete
Pong coverage nor release readiness.
