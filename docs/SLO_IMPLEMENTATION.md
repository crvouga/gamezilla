# Production SLO implementation

This branch is implementing the approved comprehensive SLO design. **It is not
ready to merge or evidence that all 48 proposed objectives are live.** Product
promises remain in [`specs/`](../specs/); operational measurement and generation
are owned by [`observability`](../libs/observability-server-ts/README.md).

## Implemented foundation

- Operational SLO code lives with server observability probes, separate from
  shared product telemetry; the cache-hygiene gate passes without exemptions.
- Strengthened existing live OpenSLO objectives in their owning contexts.
- Weekly burn thresholds spend 2%, 5% and 10% in their respective long windows.
- No rule alerts on missing events, logs or telemetry: with few people and
  no recent release, quiet is expected and needs no attention.
- Absolute failure counts notify regardless of the traffic floor; one failed
  scheduled Health check notifies immediately after its result is exported.
- Every warning routes to Grafana IRM push. OpenTofu provisions personal normal
  and Important mobile steps, including an Important repeat after one minute.
- Release reconciles shared routing, the CI failure webhook and independent
  probes through a guarded scope; branch rehearsals plan it and Health detects
  drift. The configured responder is checked against the actual IRM account.
- Zero-budget objectives generate direct violation rules, not divide-by-zero
  burn expressions or hosted Grafana budget objects. No integrity measurement
  is claimed merely because the generator can now represent its alert.
- Release now has a post-apply project alert canary: it requires the applied
  GitHub hook, configured IRM responder, correct incident routing/content, a
  mobile notification attempt and resolution. Failed/missing evidence fails
  the release job. Canary recovery cannot resolve a real run's incident.
  This code is covered by in-process HTTP/virtual-clock tests; no production
  execution or handset receipt is claimed before the first main-branch apply.
  The exact evidence and limits are in the [routing runbook](../libs/infra-shared-ts/tofu/modules/alert-routing/README.md).

## Remaining work before readiness

Grafana availability is an accepted dependency for this rollout. The independent
watchdog and a non-Grafana notification destination are deferred at the owner's
request; they do not block this PR. This does not establish delivery during a
Grafana outage.

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
7. Provision the external check cadence/locations;
   verify telemetry queryability, rule evaluation and alert delivery end to end.
8. Verify the configured responder `crvouga` on stack `shortawning2091`,
   device registration and automated delivery receipts. Phone permissions
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
