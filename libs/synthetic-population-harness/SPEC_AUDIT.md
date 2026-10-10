# Spec audit — Synthetic User continuity — 2026-10-09

Verdict: INCOMPLETE. The strict repository gate reports 17 near-duplicate
phrasings in Chess, Friends and Matchmaking. All three continuity scenarios
pass, the model is bound to actual application observations, and all five
invariants pass bounded verification through four steps. The complete
synthetic population suite passed 23 executable examples and traces. This is not a
completed audit of the wider autonomous lifecycle or failure matrix.

## Feature checks

Scope: `specs/synthetic-population/synthetic-user-continuity.feature` and
`specs/synthetic-population/synthetic-user-continuity.qnt`.

| Check | Evidence |
| --- | --- |
| A0 | Reopening, keeping an account and returning to a game are observable product behavior |
| A1 | Synthetic User, Recovery, activity, account, username, app, multiplayer game and multiplayer result resolve in the context glossary |
| A2 | No avoided synonym appears |
| A3 | Recovery and Synthetic User were explicitly defined in the user's feature request |
| A4 | Account and username are published by Profile; multiplayer chess and result are published by Chess; app is borrowed from the kernel |
| A5 | Features name no transport, database, worker or version mechanism |
| A6 | Each step's subject is the Synthetic User; Cedar is its supplied name |
| B1 | Title names recovery of current activity |
| B2 | Description states situation, motivation and outcome |
| B3 | Each of the three scenarios belongs to a Rule |
| B4 | Reopening is an unconditional world event; each Rule states why there is no refusal |
| B5 | Each scenario has one When |
| B6 | Each Given is an existing activity |
| B7 | Each When is one reopening event |
| B8 | Identity, ongoing game and finished result are observable outcomes |
| B9 | Quoted text is the Synthetic User's supplied name |
| B10 | Titles state the outcome after reopening |
| B11 | No Background is needed |
| B12 | No outlines or technical case matrix |
| B13 | Cedar is a plausible supplied name |
| B14 | Existing Given phrasings reused; new recovery outcomes have no equivalent in the synthetic population catalog; strict global gate incomplete |
| B15 | Domain and known regression tags are used |
| B16 | Four steps per scenario |
| B17 | Engineering failure cases remain outside the feature |
| C1–C6 | See STATE_COVERAGE.md; the model covers reopening only, not all autonomous activities |
| D1 | Features and model prose have no implementation path or code identifier |
| D2 | Bindings read the selected application's identity and rendered game; username observation navigates to Profile and game observation returns to the game. Review remains needed for observation-only navigation and the pre-existing pause steps that execute game actions in Then |
| D3–D6 | Continuity actions use the existing product harness, three positive UI examples and connectivity trace helpers; no alternate domain engine |
| P1–P2 | Specification text lands in a separate spec commit |

## Handoff

Reopening, identity continuity, ongoing-game continuation and finished results
are bound through the product harness. The model's three initial activities
and reopening event are bound; connectivity helpers operate the injected
connection. The package's normal model gate passes. The available-state
assertion observes authentication and the normal Spaces navigation. Complete
the broader lifecycle coverage and strict deduplication
gate before marking this audit passed.

Lease expiry, fencing, process termination, overlapping releases, lost
acknowledgements and transient database faults are engineering checks. Native
realm handoff tests already cover one active-game replacement path; the full
failure matrix remains outstanding.
