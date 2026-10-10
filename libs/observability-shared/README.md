# Universal observability audit

This is an audit and implementation status, not a declaration that the full
observability overhaul is complete. Framework APIs and delivery semantics are
documented in [the observability package](../../pkgs/observability-root-shared/README.md).

## Existing capabilities and gaps

| Area | Existing implementation | Remaining work |
| --- | --- | --- |
| Distributed traces | Official OTel API, browser fetch instrumentation, Hono request boundaries, SQL wrappers, sync mutation correlation, Durable Object boundaries, Bun/Worker/browser adapters | Independent signals need composition-root endpoint configuration; browser async context is callback-scoped |
| Collection and queries | Production Grafana Cloud Tempo, OTLP HTTP proxy for browser traces, local/CI trace artifacts, `bun obs`, MCP query tools | No configured OpenObserve deployment, endpoint, installed server version or management credential; query tools still use Tempo |
| Identity and releases | User/session/device correlation, build SHA, service version and deployment resource attributes | Consent-aware pseudonymous analytical identity, attribution linking and backend subject deletion |
| Product and gaming | Spaces, matchmaking, chess, puzzles and room systems; executable business models and journeys | Domain-owned event catalogs and emission sites, activation definitions, funnels, retention and deployed queries |
| Billing | Verified provider callbacks, subscription projections, reconciled durable payment evidence, account closure and payment retention | Reliable lifecycle emission, historical transitions, settled-price/currency and synthetic provenance for recurring-value reports |
| Marketing | No marketing generation/publishing integration found in deployed app/features | Actual provider integrations, campaign attribution, consent and reporting ingestion; no impressions/spend data can be asserted |
| Customer experience | Existing INP/LCP/CLS sampler, browser error/route/interaction boundaries | Configured metric export, single-page lifecycle/session reporting, route timing and consent controls |
| Reliability | Existing outbox, deterministic harness, Gherkin/Quint/OpenSLO bindings, production health/synthetic runner | Telemetry ingestion synthetic, business/pipeline SLO bindings and burn-rate alerts |
| Infrastructure | OpenTofu-managed Grafana stack, ingest/query credentials, secret references and deletion protection | OpenObserve streams, retention/RBAC, dashboards, alerts, version-specific provider/API validation and Actions rehearsal |
| Security | Permission decisions, authentication ports, account privacy workflow | Durable security audit policy and records; best-effort diagnostics are insufficient |

## Implemented in this change

The existing runtime adapters now support independent official OTel log and
metric SDKs with explicit OTLP endpoints or injected exporters. The logger
bridge selects a structured log sink when configured, retaining its existing
span-event path otherwise. Batches are bounded, metric dimensions are
allowlisted, Worker metrics flush without an interval, and failed invocation
flushes are isolated from product responses.

Type-safe event contracts, compatibility checks and exporter schema/privacy
guards support domain-owned definitions. A versioned message tag binds each
reliable contract to the existing transactional outbox. Its consumer waits for
export acknowledgement, carries originating W3C context and preserves event
time across retries. No new queue or persistent service was added.

HTTP request counts and duration are measured outside trace sampling using
the injected clock. The existing browser sampler records Web Vitals
observations without exporting its DOM attribution strings. INP currently
reports changes: its histogram describes observations, not one final value per
page or session. Metrics export remains opt-in until endpoints are wired.

The billing package exposes `settledPaymentReport`: it queries authoritative
payment evidence and returns exact decimal minor-unit totals separately for
each currency. Windows use original payment time; refunds reflect the current
reconciled evidence. This report includes the evidence held by the ledger; it
does not establish production/synthetic provenance. It does not calculate
MRR, ARR, churn, recognized revenue, exchange rates or attribution. Existing
subscription projections do not preserve enough authoritative price/currency
history to infer those values safely from the offer catalog.

Automated tests cover zero-percent trace sampling, named events, correlation,
event timestamps, exporter failures, replay identity, schema rejection,
privacy, metric accuracy, compatibility, analytical deduplication, UTC window
edges, erased subjects and authoritative cash/refund reconciliation. Four
literal regressions are registered under the existing known-bug directory.

## OpenObserve assessment and deployment dependencies

OpenObserve documents [OTLP ingestion](https://openobserve.ai/docs/user-guide/data-exploration/traces/traces/)
and [RUM with session replay](https://openobserve.ai/docs/user-guide/data-exploration/rum/).
Replay is a separate capability; it is not supplied by OTel. It remains
disabled here because no consent/masking policy or compatible deployed server
version has been established. Browser diagnostics should never include chat,
payment details, credentials or form input values.

The official [OpenObserve Terraform provider](https://registry.terraform.io/providers/openobserve/openobserve/latest/docs)
is a candidate for declarative streams/dashboards/alerts. This repository has
no installed provider or server version against which its resources can be
validated. No OpenObserve resources or dashboards have been deployed, and the
protected Grafana trace history has not been removed. Migrating requires an
actual target and credentials through the existing secret store, a pinned
provider/server compatibility check, import/retention planning and the
repository's GitHub Actions rehearsal before merge.

The business-wide definition of done remains outstanding: domain emission,
analytics definitions and reconciliation, attribution, synthetic provenance,
backend access/retention/erasure, OpenObserve query tooling and deployments,
dashboard suites, actionable alerts/SLOs and performance/cost validation.
The new contract APIs are available; production business domains are not yet
wired to them. No substitute analytics vendor, fake data or empty dashboard
was introduced.
