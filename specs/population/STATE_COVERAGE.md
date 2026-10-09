# Synthetic Population coverage

The user request defines the terms and administrative capabilities in this
context. The Bot Observatory contract is [observatory.feature](observatory.feature).

| Rule | Allowed example | Refused example |
| --- | --- | --- |
| View activity requires permission | Authorized observer sees desired population | Ordinary person sees permission denial and no activity |
| Configuration requires permission | Configurator changes desired population | Observer cannot change configuration |
| Pause preserves ongoing games | Controller pauses future activities | Observer cannot pause a Synthetic User |

Exclusive Worker Leases, fencing, shutdown deadlines, lost acknowledgements,
database faults and overlapping application versions are implementation
contracts. They belong in automated code and concurrency checks, with the
observable continuity contract expressed through ongoing games and Recovery.

Self-audit: A0–A6 and B1–B17 checked against the specification standard.
Terms were supplied by the user or borrowed from published contexts. Each
rule has a positive and refusal example. New steps are necessary because no
existing catalog describes Synthetic Population administration. No technical
aggregate is represented as a business-facing Quint model.
