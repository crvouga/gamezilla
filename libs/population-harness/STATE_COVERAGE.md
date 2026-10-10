# Synthetic Population coverage

The user request defines the terms and administrative capabilities in this
context. The Bot Observatory contract is [the Observatory specifications](../../specs/population/observatory.feature).

| Rule | Allowed example | Refused example |
| --- | --- | --- |
| View activity requires permission | Authorized observer sees desired population | Ordinary person sees permission denial and no activity |
| Configuration requires permission | Configurator changes desired population | Observer cannot change configuration |
| Pause preserves ongoing games | Controller pauses future activities | Observer cannot pause a Synthetic User |

Exclusive Worker Leases, fencing, shutdown deadlines, lost acknowledgements,
database faults and overlapping application versions are implementation
contracts. They belong in automated code and concurrency checks, with the
observable continuity contract expressed through ongoing games and Recovery.

Authoring coverage: the following claims still require a completed spec audit.
Terms were supplied by the user or borrowed from published contexts. Each
rule has a positive and refusal example. New steps are necessary because no
existing catalog describes Synthetic Population administration. No technical
aggregate is represented as a business-facing Quint model.

## Synthetic User continuity

| Kind | Model name | Example | Status |
| --- | --- | --- | --- |
| World event | reopenApp | All three continuity scenarios | covered |
| Invariant | invPersistentIdentity | Identity after reopening, including ongoing and finished games | covered |
| Invariant | invActivityRestored | Available, ongoing and finished activities after reopening | covered |
| Invariant | invOngoingGamePreserved | Returns to the same multiplayer game | covered |
| Invariant | invFinishedGamePreserved | Keeps the finished multiplayer result | covered |
| Invariant | invOfflineKeepsPlace | Bookkeeping: offline device keeps its last known activity and game | model-only |
| World event | _loseConnection / _comeBackOnline | Bookkeeping: changes which device has a connection | model-only |
| Transition | Browsing → Browsing | Available Synthetic User after reopening | covered |
| Transition | Playing → Playing | Ongoing game after reopening | covered |
| Transition | Finished → Finished | Finished game after reopening | covered |

Reopening is a world event with no excluded activity. The model publishes no
domain events. The initial game is a fact borrowed from Chess; ongoing and
finished games are both illustrated. The broader autonomous lifecycle and
population allocation still need additional model coverage; this model only
defines continuity after reopening.
