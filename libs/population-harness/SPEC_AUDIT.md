# Spec audit — Synthetic User continuity — 2026-10-09

Verdict: INCOMPLETE. The strict repository gate reports 17 near-duplicate
phrasings in Chess, Friends and Matchmaking. The new scenarios are undefined
and the new model is unbound, which are implementation handoffs. No model
shape or glossary error remains in the new model after the authoring check.

## Feature checks

Scope: `specs/population/synthetic-user-continuity.feature` and
`specs/population/synthetic-user-continuity.qnt`.

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
| B14 | Existing Given phrasings reused; new recovery outcomes have no equivalent in the population catalog; strict global gate incomplete |
| B15 | Only the domain tag is used |
| B16 | Four steps per scenario |
| B17 | Engineering failure cases remain outside the feature |
| C1–C6 | See STATE_COVERAGE.md; the model covers reopening only, not all autonomous activities |
| D1 | Features and model prose have no implementation path or code identifier |
| D2–D6 | Pending binding and step implementation |
| P1–P2 | Specification text lands in a separate spec commit |

## Handoff

Bind reopening, identity continuity, availability, ongoing-game continuation,
finished-game setup and finished-result continuity through the product harness.
Bind the model's initial activities and reopening event; connectivity helpers
operate the harness's injected connection. Read public model values from the
selected Synthetic User's actual app. Add the package's normal model gate.

Lease expiry, fencing, process termination, overlapping releases, lost
acknowledgements and transient database faults are engineering checks. Native
realm handoff tests already cover one active-game replacement path; the full
failure matrix remains outstanding.
