# Unified product observability

The existing Grafana Cloud stack is the collection and reporting platform:
Tempo for traces, Loki for named events and diagnostics, Mimir for metrics.
Application instrumentation uses standard OpenTelemetry and OTLP. No additional
analytics vendor or persistent service is introduced. Framework API usage is in
[the observability package](../../pkgs/observability-root-shared-ts/README.md).

## Audit and implemented coverage

| Domain | Existing capabilities reused | Added coverage |
| --- | --- | --- |
| Runtime | Browser fetch, Hono, SQL, sync and Durable Object traces; release resources; `bun obs` | Independent unsampled log/metric SDKs, request counts/duration, bounded batches and metric labels, invocation flush isolation |
| Identity | Verified identities and transactional account provisioning | Reliable first-account provisioning event; trusted real/synthetic/unknown provenance through authentication and replay |
| Multiplayer | Spaces, chess matchmaking and authoritative state persistence | Space creation/join/leave; game creation/start/completion/abort, with stable logical identities |
| Puzzles | Deterministic interaction mutations | Attempt/completion events without puzzle positions or raw player identifiers |
| Billing | Reconciled payment evidence and durable subscription projections | Authoritative reconciliation/projection snapshot events; exact currency-separated settled cash/refund report |
| Customer experience | Browser exceptions, navigation/interaction traces and performance HUD | Independent exception logs and final INP/LCP/CLS observations; restricted server-side browser ingestion |
| Reliability | Transactional outbox, scheduled jobs, deterministic harness and existing OpenSLO approach | Export acknowledgement, retries, schema violation counters, pipeline heartbeat, declarative dashboards, generated alert rules and objectives measured from the server's own metrics |
| Infrastructure | Protected Grafana stack, OpenTofu, secret store and deploy gates | Three-signal credential scopes; stack-scoped management identity; per-environment dashboard folder and alerts |

## Contracts and reliable delivery

Each owning domain exports its typed catalog in `telemetry.ts`; feature manifests
register those contracts in the runtime. The product helper pseudonymizes logical
and business entity identifiers consistently. Server replay writes an event into
the existing outbox in the same transaction as the domain change. Optimistic client
replay does not publish a reliable event. Export runs in the scheduled background
drain, outside gameplay request processing.

Stable versioned identities deduplicate enqueue attempts. Delivery uses the original
event timestamp and originating W3C trace context. The OTLP JSON exporter uses injected
HTTP and timers, bounds response size, and rejects HTTP errors, timeouts and OTLP
partial rejection even when the response is HTTP 200. A committed business operation
survives exporter failure. Physical delivery is at least once; exhausted retries need
outbox reconciliation. Queries deduplicate logical IDs; there is no exactly-once claim.

Financial snapshots describe reconciled durable records. Do not sum snapshot log
values into financial totals. `settledPaymentReport` queries authoritative payment
evidence and returns exact decimal minor-unit totals per currency. Its half-open
window uses original payment time and current reconciled refund state. The evidence
has no established synthetic provenance; it is not a GAAP revenue report.

## Analytical definitions

`@libs/runtime-shared-ts/business-usage` provides versioned meaningful-action definitions:
space creation/join, puzzle attempts and chess game starts. Active use is distinct
pseudonymous subjects participating in these events; both chess participants count.
Reports must provide both erasure and trusted synthetic subject sets; actor provenance
alone cannot classify the other participant in a mixed-player game. Population
accounts come from `syntheticPopulationAccountIds`, pseudonymized using
`telemetrySubjectId("subject.id:" + accountId)`; include other trusted synthetic
identities, such as the monitor, in that exclusion set. DAU/WAU/MAU use explicit half-open UTC windows of 1/7/30 days. Page views do not count.
Provisioned population addresses are classified before account binding, including
tombstoned bot records. Only explicitly real provenance is included; synthetic and unknown populations are
excluded. Logical duplicates and deleted subjects are excluded. Late arrivals use
event time. Game completion rates follow the started cohort as of the window end.

These are reproducible query helpers, not a new analytics storage service. They do
not establish activation, attribution, identity linking, consent or retention cohorts.
Account provisioning means the first verified external identity created an internal
account; it does not mean onboarding or activation completed.

## Grafana infrastructure and operations

[Dashboard sources](../infra-shared-ts/tofu/modules/observability-views/main.tf) provide
engineering, executive, product, multiplayer, revenue reconciliation, customer
experience and pipeline views. Panels query actual emitted records/instruments;
there are no fake values or empty placeholders. The revenue view shows reconciliation
health and records, not MRR/ARR. Loki queries use OTLP structured metadata and stable
log bodies; product counts require `event_synthetic="false"` and deduplicate event IDs.
Long windows with many logical IDs can reach Loki query series limits; use bounded
windows and authoritative reporting rather than interpreting a failed query as zero.

Every alert rule is generated, not typed: see
[Service level objectives](#service-level-objectives). Delivery goes through the
stack-wide notification policy and Grafana IRM integration in
`libs/infra-shared-ts/tofu/modules/alert-routing`, off until configured.
`sync_query_truncations_total` counts query snapshots clipped to their row limit
(query name in the warning log, never row content); it has no alert.

OpenTofu foundation manages per-environment writer/read policies, dashboard folders,
service accounts and alerts. Workers receive ingestion credentials only. Browser exports persist redacted OTLP trace and log batches in the injected local object store before acknowledging the SDK. Delivery uses the injected offline-aware HTTP and timers, retries after outages and reopening, and keeps a complete batch on partial rejection. Pending batches expire after 30 days. Browser persistence is not a guarantee against a hard page termination before the local write finishes. Browser logs
are proxied with server credentials; resource identity is forced, business claims and
private bodies are stripped, and only diagnostic attributes or scalar Web Vitals pass.
Browser cumulative metrics are not exported into a shared series. Server metric
resources identify the isolate so concurrent writers do not overwrite each other.

Schema/privacy, cardinality, delivery, correlation, analytical calculations, financial
reconciliation and dashboard structural checks run in existing package gates. Full
`bun verify` and the required GitHub Actions infrastructure rehearsal remain release
evidence; a source declaration does not prove that dashboards are deployed or backend
queries accepted. Never use manual dashboard inspection as verification.

## Service level objectives

What people experience is promised in `specs/<context>/*.openslo.yaml`, in their
words (`# live` files are measured against a deployment). This package binds each
indicator to the instrument that counts it and derives everything else. The
objectives, their targets and why, the coverage matrix and the known gaps are in
[`docs/SLO_COVERAGE.md`](../../docs/SLO_COVERAGE.md); one runbook section per
objective is in [`docs/SLO_RUNBOOK.md`](../../docs/SLO_RUNBOOK.md).

**Evidence.** Three kinds, all in the stack's Prometheus (Mimir):

| Indicator kind | Counted from | Budgeted by |
| --- | --- | --- |
| `counter-ratio`, `histogram-under` | the server's own request, save and drain instruments (`emitted-metrics.ts`) | Occurrences |
| `sample-share` on `synthetic.check.result` | one sample per live feature per Health run, recorded by `apps/product-ts/scripts/health-check-results.ts` (`synthetic-checks.ts` names the checks) | Timeslices (1 h) |
| `sample-share` on `probe_success` | Grafana Synthetic Monitoring: the app shell and API readiness (which reads the database) every minute, the broker every ten (`synthetic-monitoring.ts` names the checks; they are in `libs/infra-shared-ts/tofu/modules/synthetic-monitoring`) | Timeslices (1 min, 10 min) |
| `sample-under` on `probe_duration_seconds` | the same minute checks, by how long each took end to end | Timeslices (1 min) |

"People's requests" are the route groups in `route-groups.ts` that people cause
and wait on; the metrics carry `app.http.route_group`, derived from the route, so
machine traffic (health probes, the synthetic population worker, telemetry
uploads) never counts. A route no rule names counts as people's until a rule says
otherwise, and `apps/server-ts/tests/route-groups.test.ts` fails until it has one.

Every query selects its environment by the `deployment_environment_name` label on
the point (Grafana Cloud copies it from the resource). Synthetic Monitoring's
checks run as `<check>-<environment>` jobs instead: a check's own labels reach
its metrics only on tenants Grafana has migrated. No query joins `target_info`:
only isolates still running carry it, so a join drops everything an ended Worker
isolate counted (the old objectives, alerts and dashboards counted nothing for
this reason). A counter is counted as its growth plus the first value of each
series that appeared in the window, because a short-lived isolate may report a
single sample.

**Slices.** Every rule of an indicator with a `sliceBy` (route group, check,
probe job) is split by it: each slice burns on its own and is its own alert,
named in its `slice` annotation, so one broken game, route group or check pages
while the total still looks healthy. The hourly Health judge counts a run of
checks bad when any check in it failed, to the same effect.

**Windows.** Every objective is judged over a rolling 7 days: the metrics backend
keeps about 14, and an alert's longest window (3 days) must fit inside.

**Alerts.** Each objective gets multi-window, multi-burn-rate policies, generated
from its own target (`@pkgs/openslo-shared-ts`, `alert-policy`) in the windows its
cadence allows (`slo-alerts.ts`, `tiersFor`):

| Cadence | Page (critical) | Ticket (warning) |
| --- | --- | --- |
| standard | 14.4x over 1 h and 5 min; 6x over 6 h and 30 min | 3x over 1 d and 2 h; 1x over 3 d and 6 h |
| sparse (Health, about hourly) | 10x over 12 h and 4 h | 1x over 3 d and 12 h |

The page tiers are Grafana SLO's fast burn, the ticket tiers its slow burn. No
tier asks for more than three quarters of the fastest burn the target allows. A
policy fires when all its windows burn at least that fast and the longest window
saw enough traffic to judge (`minimumEventsPerHour`). The policies are written as
OpenSLO (`slo-alert-policies.openslo.yaml`): OpenSLO lets a policy name one
condition, so the short window is named in its
`openslo-alerting/and-conditions` annotation.

OpenSLO's conditions are burn rates only, so three companions are generated from
the same files (`companion-alerts.ts`):

- **Silence**: each source of evidence behind a tier 0 or 1 objective (a metric
  at one cadence) has a rule that fires when nothing was counted for the
  indicator's `silence.after`, so no traffic or no checks can never look like a
  perfect objective.
- **Low traffic**: while a window holds fewer events than the burn rates need,
  an indicator's `lowTraffic` counts the bad ones instead: for people's
  requests, one failure (or one wait past 2.5 s) pushes and three in an hour
  page. Zero tolerance cannot wait for traffic large enough for a ratio.
- **Certificates**: the certificate the checks are shown, 14 days (push) and 3
  days (page) before it expires.

**Routing.** Every rule carries `route`, `tier`, `capability` and (for an
objective) `slo` labels, and annotations with the budget spent and remaining,
the burn rate, the SLO dashboard, Explore already scoped to the environment's
error logs and failed traces, the runbook section and the `bun obs` command.
`route` is decided by `routeOf`: a critical alert on a tier 0 or 1 objective
pages (Grafana IRM's paging chain, production only); any other critical alert
and every tier 0 or 1 warning pushes (IRM, never pages); a tier 2 warning waits
for the daily digest. The one notification policy and IRM integration for the
stack are in `libs/infra-shared-ts/tofu/modules/alert-routing`, applied by the
bootstrap stack once `alerting` in `global.tfvars.json` names the responder's
IRM username and the digest address (the provider reaches IRM through the
instance itself); until then alerts keep the stack's existing policy. Rules use
a threshold condition, so each slice of a split rule is its own alert instance.

**Grafana SLO.** Each live objective becomes one `grafana_slo` per environment
(`slo-grafana.ts` → `grafana-slos.generated.json` → `observability-views/slos.tf`):

| OpenSLO | Grafana SLO |
| --- | --- |
| `metadata.displayName`, `spec.description` | name (with the environment), description |
| the one objective's `target`, rolling `timeWindow` | objective value and window |
| the indicator's catalog entry | a freeform ratio query (`sloRatioQuery`), grouped by its `sliceBy` |
| `metadata.labels` `tier` | label `tier` |
| `spec.service`, `metadata.name`, the entry's owner | labels `service`, `slo`, `owner` |
| none | folder: the environment's observability folder; alerting: none, the rules above alert |

Grafana SLO has no time slices: its dashboards show the share of good samples,
and sparse hourly samples draw gaps. The authoritative judge is the hourly
`health:objectives` job.

An alert reaches a person by two paths from the same policies:

1. **Health job.** The hourly `health:objectives` job on `main` measures each
   environment through `OBS_PROMETHEUS_URL`, `OBS_PROMETHEUS_USER` and the read
   token `OBS_TEMPO_TOKEN`, judges the 7-day objective (in time slices for the
   checks) and every policy, and fails with the owner, runbook, burn rate,
   remaining budget and command when one fires. No data, an unreachable backend
   or missing credentials fail it with the reason; they never pass.
2. **Grafana.** While the instance is active, OpenTofu creates the rules in
   `alert-rules.generated.json` and the SLOs in `grafana-slos.generated.json` in
   `libs/infra-shared-ts/tofu/modules/observability-views`.

**Add an objective.** Write the `SLI` and `SLO` in a `# live` spec file (a `spec:`
commit) with a `tier` label, add one entry to `INDICATORS` in
`slo-indicators.ts`, add `apps/product-ts/tests/openslo/<stem>.binding.ts`
(`liveMetricBinding`), add its section to `docs/SLO_RUNBOOK.md` and its row to
`docs/SLO_COVERAGE.md`, then run
`bun run libs/observability-shared-ts/scripts/slo-generate.ts` and commit the
three generated files. A new live feature also needs its name in
`SYNTHETIC_CHECKS` and an indicator that counts it. The checks follow: every live
indicator is bound and every binding used; every check is counted by exactly one
indicator; instruments, labels and values exist; a latency bound is a histogram
bucket edge; every judged objective has a tier and the right budgeting; rules
carry owner, severity, route, runbook, command and select their environment;
generated files equal their generator and no `grafana_slo` exists without an
objective; every objective has a runbook section.

Metric names are derived from the instrument contracts (`emitted-metrics.ts`,
`prometheusSeries`), never typed.

## Alert runbooks

These rules are pipeline alerts in `src/pipeline-alerts.ts`, generated with the
rest. Their counters carry `deployment_environment_name` on each point, because a
Worker isolate's resource information goes stale soon after the isolate ends.
Inspect production read-only (`bun obs … --source prod`, `OBS_READONLY_DATABASE_URL`);
never write to a production database by hand. Each alert clears on its own once
its window passes with nothing new.

### A certificate people are shown expires

`probe_ssl_earliest_cert_expiry` from Synthetic Monitoring's checks is within 14
days (push) or 3 days (page). The `slice` names the check: `app-shell` and
`api-ready` are Cloudflare's edge certificates for the web and API hosts;
`broker` is the ACM certificate on the AWS IoT Core custom domain
(`libs/infra-shared-ts/tofu/modules/pubsub`), renewed by AWS while its DNS
validation records stay in Cloudflare. Once it expires nobody can open the app or
receive live updates.

1. Cloudflare: the zone's SSL/TLS edge certificates show the renewal state; a
   paused zone or a removed DNS record blocks it.
2. AWS: ACM shows why a renewal is pending; recreate a missing validation record
   by applying the edge or foundation stack, never by hand.

### Outbox deliveries exhausted their retries

`outbox_deliveries_exhausted_total` grew in the last hour. A background delivery
failed on its last attempt (8 by default, about 16 minutes of backoff) or carried a
payload its consumer can never read, and is parked. Its effect — a notice, a match
step, an account erasure, a telemetry export — has not happened and will not happen
by itself.

1. Find the `outbox delivery exhausted` log (`bun obs last --errors --source prod`):
   it names the event, the consumer and the error.
2. Fix the cause and ship the fix through Release.
3. Leave the parked row as it is: it is the only record of the missed effect. There
   is no replay command; re-running the effect is a reviewed change shipped like any
   other, not an edit to the row.

### Scheduled outbox drain keeps failing

`outbox_drain_runs_total{app_outcome="failure"}` counted at least three failed
scheduled drains in fifteen minutes. The telemetry heartbeat is recorded before the
drain on purpose, so "Telemetry heartbeat is absent" stays quiet: the schedule runs,
the drain behind it does not. Background work and event export wait; nothing is
lost, since pending deliveries resume when a drain succeeds.

1. Read the `outbox cron drain failed` error (`bun obs last --errors --source prod`).
   Usual causes are an unreachable database, a failed application boot
   (configuration) or a consumer failing outside its own delivery.
2. If it began with a deployment, ship a fix or a revert through Release.
3. No data repair is needed.

### Billing provider callbacks are being refused

`billing_callbacks_total{app_outcome=~"unverified|failed"}` counted at least three
refused provider callbacks in an hour. A failed signature answers 400, which the
availability alert never counts. Payment and membership changes may not reach
accounts. The provider retries refused deliveries, so they arrive once the cause is
fixed.

1. Compare outcomes: every callback `unverified` after a deployment or rotation
   means the deployed signing secret no longer matches the provider's webhook
   endpoint (kept by `@libs/billing#billing:sync`); `failed` means processing threw,
   so read its trace.
2. A few `unverified` callbacks while `accepted` ones still arrive are strangers
   probing the endpoint; `unknown_provider` is counted and never alerts.
3. Never turn signature checks off to let callbacks through.

## Runtime failure investigation

`bun obs last --errors` queries local journals; `--source prod` queries the shared
Grafana backend. Tempo error search uses error status and reads the full traces;
search metadata alone does not provide error counts. Trace resources identify the
actual deployment environment, service, build and instance. A shared backend may
contain multiple environments.

Standalone error logs also produce searchable exception traces. Worker background
work and Durable Object alarms flush failures at their boundaries. Local supervisors
retain unexpected exit codes, signals and bounded redacted stderr after the child or
collector stops; a fresh stack start preserves that evidence. Scheduled Bun room
work has an explicit owner, and socket failures close the affected connection.

The live trail health check makes an application request with a known trace context
and requires its corresponding server trace, rather than accepting an empty upload
as proof of app instrumentation. Platform-enforced termination, resource exhaustion
and isolate startup failures may precede application exporters. `bun obs platform --service <worker-name> --window 1h` reads Cloudflare's
retained native runtime errors independently of application export. It loads the
configured Cloudflare credentials through the secrets entry point and only queries
the named Worker. Missing read access is reported as an unavailable source, not an
empty result. Platform retention and account sampling still limit historical coverage. A trace can only contain an exception stack when
the runtime supplied one.

## Remaining limitations

No deployed marketing generation/publishing system or trustworthy impression/spend
feed was found. Campaign consent, persisted attribution, anonymous identity linking
and narrowly scoped external reporting adapters remain work; no marketing figures
are invented. Existing subscription projections lack authoritative historical settled
price/currency changes needed for MRR, ARR, churn and lifetime-value estimates.

Backend subject erasure, retention tiers and restricted security-audit access require
an explicit policy and backend integration. Pseudonymization is not anonymization;
pattern redaction cannot prove that arbitrary diagnostic text has no personal data.
Durable security audit records, consent governance and session replay are not supplied
by this change. Replay remains disabled. Synthetics with unknown provenance are
excluded from business counts, rather than assumed to be genuine activity.

The dashboard/alert resources require a successful Actions plan against the existing
Grafana stack and its hosted datasource names before merge. Production deployment
requires the repository's human merge and full Release gates. The broader business-wide
mission is not proven complete by the instrumentation and dashboards alone.
