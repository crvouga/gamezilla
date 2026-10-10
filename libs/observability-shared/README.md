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
DAU/WAU/MAU use explicit half-open UTC windows of 1/7/30 days. Page views do not count.
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

Four owner/severity/runbook-tagged alert rules cover a provisional 99% API availability
fast burn (5-minute and 1-hour windows with a traffic floor), repeated reliable export
failures, contract violations and a missing scheduled heartbeat. Delivery destinations
inherit the stack's existing notification policy; no new contact channel is created.
Additional business SLOs require owned objectives and compatible existing bindings.

OpenTofu foundation manages per-environment writer/read policies, dashboard folders,
service accounts and alerts. Workers receive ingestion credentials only. Browser exports use the injected offline-aware HTTP and timers. Browser logs
are proxied with server credentials; resource identity is forced, business claims and
private bodies are stripped, and only diagnostic attributes or scalar Web Vitals pass.
Browser cumulative metrics are not exported into a shared series. Server metric
resources identify the isolate so concurrent writers do not overwrite each other.

Schema/privacy, cardinality, delivery, correlation, analytical calculations, financial
reconciliation and dashboard structural checks run in existing package gates. Full
`bun verify` and the required GitHub Actions infrastructure rehearsal remain release
evidence; a source declaration does not prove that dashboards are deployed or backend
queries accepted. Never use manual dashboard inspection as verification.

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
