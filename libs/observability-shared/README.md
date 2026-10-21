# Unified product observability

The existing Grafana Cloud stack is the collection and reporting platform:
Tempo for traces, Loki for named events and diagnostics, Mimir for metrics.
Application instrumentation uses standard OpenTelemetry and OTLP. No additional
analytics vendor or persistent service is introduced. Framework API usage is in
[the observability package](../../pkgs/observability-root-shared/README.md).

## Audit and implemented coverage

| Domain | Existing capabilities reused | Added coverage |
| --- | --- | --- |
| Runtime | Browser fetch, Hono, SQL, sync and Durable Object traces; release resources; `bun obs` | Independent unsampled log/metric SDKs, request counts/duration, bounded batches and metric labels, invocation flush isolation |
| Identity | Verified identities and transactional account provisioning | Reliable first-account provisioning event; trusted real/synthetic/unknown provenance through authentication and replay |
| Multiplayer | Spaces, chess matchmaking and authoritative state persistence | Space creation/join/leave; game creation/start/completion/abort, with stable logical identities |
| Puzzles | Deterministic interaction mutations | Attempt/completion events without puzzle positions or raw player identifiers |
| Billing | Reconciled payment evidence and durable subscription projections | Authoritative reconciliation/projection snapshot events; exact currency-separated settled cash/refund report |
| Customer experience | Browser exceptions, navigation/interaction traces and performance HUD | Independent exception logs and final INP/LCP/CLS observations; restricted server-side browser ingestion |
| Reliability | Transactional outbox, scheduled jobs, deterministic harness and existing OpenSLO approach | Export acknowledgement, retries, schema violation counters, pipeline heartbeat, declarative dashboards and four alert rules |
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

`@libs/runtime-shared/business-usage` provides versioned meaningful-action definitions:
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

[Dashboard sources](../infra-shared/tofu/modules/observability-views/main.tf) provide
engineering, executive, product, multiplayer, revenue reconciliation, customer
experience and pipeline views. Panels query actual emitted records/instruments;
there are no fake values or empty placeholders. The revenue view shows reconciliation
health and records, not MRR/ARR. Loki queries use OTLP structured metadata and stable
log bodies; product counts require `event_synthetic="false"` and deduplicate event IDs.
Long windows with many logical IDs can reach Loki query series limits; use bounded
windows and authoritative reporting rather than interpreting a failed query as zero.

Seven owner/severity/runbook-tagged alert rules cover a provisional 99% API availability
fast burn (5-minute and 1-hour windows with a traffic floor), repeated reliable export
failures, contract violations, a missing scheduled heartbeat, and the three in
[alert runbooks](#alert-runbooks). Delivery destinations
inherit the stack's existing notification policy; no new contact channel is created.
Additional business SLOs require owned objectives and compatible existing bindings.
Each rule is one series per environment, so it raises one alert however many events
cross its threshold. `sync_query_truncations_total` counts query snapshots clipped to
their row limit (query name in the warning log, never row content); it has no alert.

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

## Alert runbooks

These counters carry `deployment_environment_name` on each point, because a
Worker isolate's resource information goes stale soon after the isolate ends.
Inspect production read-only (`bun obs … --source prod`, `OBS_READONLY_DATABASE_URL`);
never write to a production database by hand. Each alert clears on its own once
its window passes with nothing new.

### Outbox deliveries exhausted their retries

`outbox_deliveries_exhausted_total` grew in the last hour. A background delivery
failed on its last attempt (8 by default, about 16 minutes of backoff) or carried a
payload its consumer can never read, and is parked. Its effect — a notice, a match
step, an account erasure, a telemetry export — has not happened and will not happen
by itself.

1. Find the `outbox delivery exhausted` log (`bun obs last --errors --source prod`):
   it names the event, the consumer and the error.
2. Fix the cause and ship the fix through Deploy.
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
2. If it began with a deployment, ship a fix or a revert through Deploy.
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
requires the repository's human merge and full Deploy gates. The broader business-wide
mission is not proven complete by the instrumentation and dashboards alone.
