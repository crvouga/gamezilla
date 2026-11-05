# Production SLO implementation

This branch is implementing the approved comprehensive SLO design. **It is not
ready to merge or evidence that all 48 proposed objectives are live.** Product
promises remain in [`specs/`](../specs/); operational measurement and generation
are owned by [`observability`](../libs/observability-shared-ts/README.md).

## Implemented foundation

- Strengthened existing live OpenSLO objectives in their owning contexts.
- Weekly burn thresholds spend 2%, 5% and 10% in their respective long windows.
- Independent missing-evidence rules for each known check and selected route;
  a healthy sibling cannot mask an absent check. Supporting checks participate.
- Absolute failure counts notify regardless of the traffic floor; one failed
  scheduled Health check notifies immediately after its result is exported.
- Every warning routes to Grafana IRM push. OpenTofu provisions personal normal
  and Important mobile steps, including an Important repeat after one minute.
- Zero-budget objectives generate direct violation rules, not divide-by-zero
  burn expressions or hosted Grafana budget objects. No integrity measurement
  is claimed merely because the generator can now represent its alert.

## Remaining work before readiness

1. Bind the proposed client startup, error-free activity, local interaction and
   accessibility measures to real outcomes and timed independent journeys.
2. Instrument complete identity and profile outcomes, including consent return,
   wrong-account checks, revocation and progress carryover.
3. Measure space lifecycle, presence, every supported game's setup/play/result,
   compatible matching, continuous-action freshness and watcher delivery.
4. Measure local durability, sync convergence, reconnect recovery, offline
   continuity, publication/pack outcomes and assistant correctness/latency.
5. Bind social, inbox, payment entitlement, uploaded-file and independent
   feedback outcomes with starts, deadlines, logical deduplication and backlog
   reconciliation. Successful HTTP status alone is insufficient evidence.
6. Implement authoritative integrity and privacy-deadline reconciliation,
   isolated recovery exercises and coverage/freshness monitoring.
7. Provision the external check cadence/locations and independent watchdog;
   verify telemetry queryability, rule evaluation and alert delivery end to end.
8. Set the actual IRM responder (currently null in global configuration),
   verify device registration and automated delivery receipts. Phone permissions
   are not established by Terraform. Do not invent a username or report delivery
   from source validation.
9. Run the complete local gate and hosted infrastructure rehearsal, finish
   independent review and confirm the exact PR head's required checks. A human
   merges. The local gate uses an isolated snapshot, so it must be rerun after
   implementation changes rather than treating an earlier snapshot as final.

## Verification record

Focused regression tests reproduced sibling-check masking, email-only warnings
and zero-budget arithmetic before the fixes. Tests also cover the actual generated
policies, metric queries, objective evaluation and artifact drift. Current commands
and run outcomes are recorded in the PR; no manual product verification is used.

The October 26 figures in [`SLO_COVERAGE.md`](SLO_COVERAGE.md) are historical
baseline evidence, not a current production assessment or the new target policy.
