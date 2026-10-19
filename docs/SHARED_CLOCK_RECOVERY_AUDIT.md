# Shared clock recovery audit

Scope: `specs/games/matched-game-clock-recovery.qnt`, with its existing
examples. The daily-clock correction follows the definitions of `clock` and
`daily game` in `specs/games/ubiquitous-language.yml` and
`matched-game-daily-clock.feature:14`; it introduces no behavior or vocabulary.

The literal sequence is a daily game after both first moves, 60 seconds
passing, then Alice making the next move. The previous model left Alice at
86,340 seconds after handing the turn to Bob. The existing feature and
glossary require the person not to move to show the full days. Both clocks
must therefore show 86,400 seconds immediately after this move.

## Example map and language checks

Context: Chess. Aggregate: shared clock recovery.
Story: people keep the same daily game and the agreed days for every move,
including across a shared pause.
Positive example: Alice's legal move starts Bob's full day and Alice's
inactive clock shows a full day.
Negative example: Bob's out-of-turn move resets neither clock
(`matched-game-daily-clock.feature:19`).
Commands, world events, actors and vocabulary are unchanged. The new
invariant uses only existing terms: daily game, person, move and days.
A0–A6 and D1: no new terms, technical prose, borrowed concepts or app-specific
mechanism. B1–B17: no feature text, scenario, step or tag changes. There is no
new step phrasing. The existing examples supply the positive and refusal
cases; no counter-example or assertion is removed.

## Aggregate coverage

Paths in this table are relative to `specs/`.

| Obligation | Evidence |
| --- | --- |
| `playMove`, daily legal / out of turn | `games/matched-game-daily-clock.feature:14`, `:19` |
| `playMove`, offline / paused / finished refusal | `games/matched-game-recovery.feature:7`, `games/matched-game-interruption.feature:40`, `games/matched-game-clock.feature:41` |
| `resignPlay`, active / already finished | `games/matched-game-ratings.feature:7`, `:34` |
| `resignPlay`, offline / paused refusal | `games/matched-game-offline.feature:13`, `games/matched-game-interruption.feature:46` |
| `openMultiplayer`, unfinished / finished | `games/matched-game-interruption.feature:52`, `games/matched-game-record.feature:43` |
| `multiplayerTimePasses`, running / paused | `games/matched-game-daily-clock.feature:10`, `games/matched-game-interruption.feature:9` |
| `loseConnection`, connected → offline | `games/matched-game-recovery.feature:26` |
| `comeBackOnline`, offline → connected | `games/matched-game-recovery.feature:14`, `:21` |
| Shared stop / return | Model-only fault helpers; observable pause and resume in `games/matched-game-interruption.feature:9`, `:34` |
| `invPauseKeepsGame` | `games/matched-game-interruption.feature:9`, `:34`, `:40` |
| `invResultIsCountedOnce` | `games/matched-game-interruption.feature:62`, `:78`, `:85` |
| `invFinishedRecordIsHonest` | `games/matched-game-interruption.feature:69`, `games/matched-game-record.feature:43` |
| `invOnlyUsableTurnCanMove` | `games/matched-game-clock.feature:22`, `:27`, `games/matched-game-interruption.feature:40`, `games/matched-game-recovery.feature:7` |
| `invSameGame` | `games/matched-game-interruption.feature:34`; the two-to-four move bound is model bookkeeping |
| `invDailyClockKeepsFullDays` | `games/matched-game-daily-clock.feature:10`, `:14`, `:19` |
| `invClocksAreNonnegative` | `games/matched-game-daily-clock.feature:58`, `:66` |
| `invOfflineCannotMove` | `games/matched-game-recovery.feature:7` |
| `invPauseIsShown` | `games/matched-game-interruption.feature:52` |

C1–C4: commands, observed invariants and relevant allowed/refused transitions
are mapped above. Going offline and returning are world events, without
illegal transition rows. C3/C5: this aggregate publishes no event; its initial
world is an already accepted game. Match formation remains in the existing
multiplayer and matchmaking contracts. C6: the daily model now agrees with
its existing example; no example is demoted or removed.

## Automated evidence and handoff

Quint, TypeScript backend, seed `0x67932`, 20 samples, zero additional steps:
initializer `init.then(multiplayerTimePasses(60)).then(playMove("alice"))`,
invariant `invDailyClockKeepsFullDays`. Before correcting `playMove`, the
invariant fails with Alice at 86,340 and Bob at 86,400. After correction the
same command passes. All nine invariants also pass together for 100 seeded
traces of 40 steps on the TypeScript backend. All previous pause, outcome
and rating invariants remain.

The strict spec gate remains incomplete while the existing recovery models
are unbound and their shared-interruption steps are undefined. These are the
implementation handoff, not a claim of a green gate. D2–D6 must be checked
again after binding. The strict gate also reports two existing near-duplicate
step phrasings outside this model correction (Custom Game resignation and
being in a space); their B14 findings remain open for the implementation
pass. No product implementation is part of this spec commit.
