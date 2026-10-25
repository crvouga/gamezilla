# Pong move review contract

Verdict: **PASS for Pong move-list availability**. The whole Pong context,
all thirty-two drawn traces of the two affected models, their existing
regressions, static checks and policy gates pass. Full-goal verification remains
incomplete; turn-game review has its own execution evidence below.

Scope: the complete `pong-scoring` and `pong-shared-control` aggregates, their
features, and the existing Games move-list term published and borrowed
by Pong. No term or meaning was invented. This supplements the scoring audit
and shared-control evidence in `@libs/games-shared-ts/docs/REALTIME_IMPLEMENTATION.md`.

## Feature verification

| IDs | Evidence |
| --- | --- |
| A0–A6, D1 | People see scores, guide their paddles, return to a game and cannot review moves in a game with no turns. All words are existing Pong, the published Games move list, or kernel terms. No mechanism, avoided synonym or new vocabulary appears. |
| B1–B3, B10 | Existing capability titles, situation/motivation/outcome descriptions, rules and unique action titles are retained. |
| B4, B8 | Existing positive/refusal examples remain; score retention explicitly has no counter-example. The added refusal names the reason: both Pong paddles can be guided at once. |
| B5–B9 | Every scenario still has one When. The added Then reads an offered action; it does not change play or prescribe copy, implementation counts or procedures. |
| B11–B13 | Backgrounds and business dimensions are unchanged. Reopening covers countdown, play with a point, and a final victory. A late viewer covers a separate person's controls. |
| B14–B17 | One new phrase is reused for local and matched play. The regression tag identifies a literal existing reopening outline. These four examples have six steps with Background (B16 warning), below the blocking limit. Each extra assertion distinguishes paddle guidance from move review. All outcomes are visible. |
| P1–P2 | Text and model edits are committed in a spec-only commit. Existing fixture/binding changes remain implementation work. |

## Scoring coverage

| Kind | Name | Evidence |
| --- | --- | --- |
| world event | countdownEnds | First serve begins at zero–zero |
| world event | pointWon | Both paddles' passing-ball rows and the final point |
| world event | waitAfterFinish | Time cannot add a point to a finished game |
| command | reopenApp | All three reopening stages |
| invariant | invScores | First serve, one-point rows and final score at the target |
| invariant | invVictory | Final point and stopped ball |
| invariant | invFinishedScore | Time after victory and reopening the finished game |
| invariant | invReopening | Every reopening row |
| invariant | invNoMoveReview | Every reopening row refuses a move list, naming simultaneous paddle guidance |
| legal transitions | countdown → playing → countdown/finished; each stage → itself on reopening | Existing serve, point, victory and reopening examples |
| illegal world events | point outside play; countdown after completion | Model-only guards; no ball in play supplies such a point |

## Shared-control coverage

| Kind | Name | Evidence |
| --- | --- | --- |
| command | guidePaddle | All six edge/middle movements; Bob's own paddle; both takeover refusals |
| world event | loseConnection | Each player, Carol and the last-known-court example |
| world event | connectionReturns | Both player-return rows |
| invariant | invCourt | All edge/middle rows |
| invariant | invSharedCourt | Both people after guidance; late Carol; both returning players |
| invariant | invOfflineCourt | Carol retains the earlier court |
| invariant | invOwnControls | Each person's own paddle; Carol's refusal; unavailable player rows |
| invariant | invRefusedControl | Bob/Carol takeover attempts leave the other paddle unchanged |
| invariant | invGameShown | The missing-connection examples keep the court visible |
| invariant | invNoMoveReview | Late Carol sees play with no move review offered |
| legal transitions | connected ↔ missing connection; each allowed/refused paddle guidance | Existing player/Carol loss/return and ownership examples |
| illegal world events | losing an already absent connection or returning one already present | Model-only world-event guards |

Neither aggregate publishes event variants. The Games → Pong relationship
already exists; only vocabulary publication/borrowing changes. Every When still
maps to an existing action. The new field is an observable availability fact,
not a new review command invented for Pong (C1–C6).

## Implementation and evidence

The reader checks actual move controls on a visible local or matched Pong
court, refusing to treat a missing court as evidence of unavailable controls.
The new Then is one public read and assertion; the models read the same
availability. There are no selectors, SQL, product rules, skips, retries or
wall timers in the step or bindings (D2–D6).

The shared-control regression fixtures gained only `moveListOffered = false`
for each person. Their prior fields, actions and states are unchanged, verified
by `pong-move-list-fixture-shape.json` under `.cache/pong/`. The implementation
uses the registered turn capability rather than naming Pong or inferring it
from an empty move list. Custom history selection/statistics remain; finished
matched games retain their record controls. No new styling or design token is
introduced. Existing turn games keep the same review components.

Authoring evidence is
`pong-move-list-author-gate.log` and `pong-move-list-author-models.log`
under `.cache/pong/`; the gate handed off only the new undefined step.

- `pong-move-list-local-red.log`: all three local stages offered unused controls.
- `pong-move-list-matched-red.log`: the late matched viewer offered them too.
- `pong-after-move-list-cleanup.log`: the whole context passes all 61 checks.
- `pong-move-list-all-traces.log`: all 32 drawn traces, 8 model checks and 3
  existing regressions pass (43 checks).
- `pong-move-list-quality-current.log`: all eight affected type/lint/unit tasks
  pass.
- `pong-move-list-final-policy-gates.log`: all four policy/freshness tasks pass.
- `turn-game-review-after-cleanup.log`: all 74 ordinary-game review/history
  checks pass across the eligible production and kitchen-sink registrations.
  This is not a full-gate claim.
