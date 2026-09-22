# ADR 0001: End-to-End Observability

- Status: accepted
- Date: 2026-09-22
- Scope: browser client, Cloudflare Workers, Bun/Node tooling, sync engine, SQL clients, CI artifacts

## Context

The repository had a bespoke `Observability`/`Span` port, a local HTTP collector,
and boundary-specific manual propagation. That design duplicated the OpenTelemetry
API, could not join ecosystem or Cloudflare platform spans through
`context.active()`, and made the local-first mutation chain dependent on an
in-process abstraction. It is replaced rather than retained as a compatibility
layer.

The system is optimized for coding agents. A useful result is a short,
deterministic causal narrative which is queryable after the original process or
test is gone. Dashboards and metrics are not part of this decision.

## Repository inventory

- Workspaces and task graph: Bun workspaces plus Turborepo; TypeScript targets
  `ESNext`; tests run with `bun test`.
- Client: SolidJS in `libs/client-app`/`apps/client`, with local SQLite and the
  `@pkgs/sync-engine` outbox.
- Server: Hono in `libs/server-app`, composed by `apps/server`, deployed to a
  Cloudflare Worker. Room traffic has a separate Worker/DO in
  `apps/room-server`.
- Database: `SqlClient` adapters over Postgres (Bun TCP locally and Worker-safe
  adapters in deployed compositions). SQL is represented as parameterized
  `Sql` values.
- Previous telemetry used `@pkgs/logger` plus a proprietary tracing facade and
  local file collector. The server already had Hono and SQL wrappers; the
  browser already had fetch wrapping. This change deletes those tracing APIs.
- PostgreSQL monitoring: `libs/db/src/scripts/enable-pg-monitoring.ts` provisions
  `pg_stat_statements` and slow-statement/`auto_explain` settings when the target
  permits them. Provider statement-log access is not assumed by agent tooling.
- CI/e2e: one Bun-based simulation harness, package-owned e2e suites, GitHub
  Actions artifacts, and no Playwright runner. The design therefore integrates
  with the existing recording driver/test harness instead of introducing a
  second test runner.

## Current-platform verification

### Cloudflare native tracing propagation spike

On 2026-09-22, a throwaway Worker was run with Wrangler 4.136.1 and:

```json
{
  "observability": {
    "traces": { "enabled": true, "head_sampling_rate": 1 }
  }
}
```

The request carried:

```text
traceparent: 00-11111111111111111111111111111111-2222222222222222-01
```

Local Explorer recorded the invocation root under trace
`fda34be99f56999d1bd961168abb1098`, with the custom `spike.request` span and
the automatically instrumented outbound `fetch` correctly parented below it.
The supplied trace id `11111111111111111111111111111111` did not appear.

Result: Cloudflare native tracing does **not** continue an inbound W3C trace in
the tested runtime. Native custom spans also currently expose no
`spanContext()` and no manual parent-child wiring, so application code cannot
repair that break. Native tracing remains valuable as a supplementary platform
trace, but is not the cross-stack source consumed by `obs`.

The same spike compiled and executed a `using` resource and observed disposal
before responding. Explicit resource management is therefore viable in the
current workerd toolchain. Bun also exposes `Symbol.dispose` and
`Symbol.asyncDispose`; the existing browser test preload already installs the
symbols and transforms explicit resource management.

Current primary references:

- [Cloudflare traces](https://developers.cloudflare.com/workers/observability/traces/)
- [Cloudflare custom spans](https://developers.cloudflare.com/workers/observability/traces/custom-spans/)
- [Cloudflare Local Explorer](https://developers.cloudflare.com/workers/local-development/local-explorer/)
- [Cloudflare OTLP export](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
- [OpenTelemetry database spans](https://opentelemetry.io/docs/specs/semconv/db/database-spans/)
- [Tempo MCP server](https://grafana.com/docs/tempo/latest/api_docs/mcp-server/)

### Other verified constraints

- Native custom spans use `tracing.enterSpan(name, callback, ...args)` for an
  active, automatically-ended scope and `startActiveSpan` for manual lifetime.
  The active context exists only inside the callback.
- Local Explorer is available by default in current Wrangler. Its OpenAPI
  document is served at `/cdn-cgi/local/explorer/api`; the trace query endpoint
  is `POST /cdn-cgi/local/explorer/api/local/observability/query`. The adapter
  discovers this schema rather than freezing it in application code. The old
  `X_LOCAL_OBSERVABILITY` opt-in is not required.
- Cloudflare OTLP export supports traces and logs, not metrics. Native trace
  billing begins 2026-10-01. Cloudflare currently documents different quotas
  for stored native events and exported events, so cost controls remain
  configuration, never tail sampling in application code.
- Tempo exposes its MCP server at `/api/mcp`, with TraceQL search, trace lookup,
  attribute discovery, and TraceQL documentation resources.
- `pg_stat_statements` and `pg_stat_activity` are queried through the database
  connection when permissions allow. Neon Functions/Object Storage log APIs do
  not constitute guaranteed Postgres statement-log access, so `obs slow` must
  degrade to DB spans plus `pg_stat_statements` rather than depend on provider
  logs.

## Decision

1. `@opentelemetry/api` is the only recording port. Helpers accept and return
   real OTel `Span`/`Context` values. There is no repository `Tracer`, `Span`, or
   `Observability` interface.
2. `@pkgs/observability` has hard runtime entrypoints: `core`, `browser`,
   `worker`, `node`, and read-only `query`. SDK packages appear only in runtime
   adapters. `core` contains vocabulary, correlation, narration, and thin span
   helpers.
3. Browser, Worker, and Node register their own providers/processors/exporters.
   The browser does not use Zone.js. Callback `withSpan` is mandatory where
   child fetch/DB/platform work must inherit context; disposable spans express
   lifetime only.
4. The Worker cross-stack path uses an OTel-compatible Worker adapter with W3C
   extraction/injection and request-lifetime flushing. Cloudflare native traces
   stay enabled for platform-only visibility, but are not assumed to connect to
   the browser trace until Cloudflare ships and regression-tests inbound
   continuation.
5. Collector/OTLP configuration is the backend seam. Local and CI also support
   NDJSON so an artifact remains queryable without a network or credentials.
6. Telemetry is not the source of truth. Mutation ids and originating
   `traceparent` are persisted with the local outbox; reconnect creates a new
   trace linked to the originating interaction. An append-only Postgres event
   relation keeps indexed correlation keys for durable reconstruction.
7. Instrument only boundaries: interaction/route/error sink, sync batch and
   mutation lifecycle, HTTP middleware, SQL client, and runtime composition.
   Business use cases do not import observability.
8. Attributes and events are allowlisted vocabulary. Redaction is default-deny
   before export. SQL telemetry includes parameterized statement text only.
9. Sampling is 100% in local and CI. Production uses configurable head sampling
   and a kill switch. Tail sampling is rejected because successful wrong-answer
   requests are diagnostically important.
10. The agent interface is `obs`: narrated output by default, stable ordering,
    bounded overview size, meaningful exit codes, and a suggested next command
    in every result.

## Boundary-file inventory

The definition-of-done count is **20 production `src/` files outside the three
observability packages**. This is higher than the brief's target of seven files,
but it is still seven conceptual boundaries. The extra 13 files preserve the
repository's package/runtime ownership seams; none is a feature use case or a
business-logic loop.

Eighteen files import an observability entrypoint and are reproducible with:

```sh
rg -l '@pkgs/observability/(browser|core|node|query|worker)' apps libs pkgs \
  --glob '**/src/**/*.{ts,tsx}' \
  --glob '!pkgs/observability/**' \
  --glob '!pkgs/observability-cli/**' \
  --glob '!pkgs/observability-mcp/**'
```

The remaining two are deliberately dependency-free critical-path bridges:
`libs/client-app/src/shell/wall-client-env.ts` invokes a context runner installed
by the lazy browser boundary, and `pkgs/logger/src/logger.ts` emits through a
provider-installed symbol callback. They preserve propagation and correlated
logs without pulling the browser SDK/core into initial JavaScript.

| Conceptual boundary | Production boundary file | Why the file is required |
| --- | --- | --- |
| Runtime composition | `apps/client/src/main.tsx` | Registers the browser provider at the browser entrypoint. |
| Runtime composition | `apps/server/src/server.ts` | Registers and flushes the API Worker provider and observes Worker fetch/scheduled entrypoints. |
| Runtime composition | `apps/room-server/src/room.ts` | Registers and flushes the independent room Worker provider. |
| Runtime composition | `libs/sim-harness/src/preload.ts` | Registers the Node provider and NDJSON exporter at the e2e process entrypoint. |
| Client interaction/route/error | `libs/client-app/src/shell/observability/browser-boundaries.ts` | Owns delegated interaction, route, and browser/Solid error spans. |
| Client interaction/route/error | `libs/client-app/src/shell/observability/browser-identity.ts` | Owns browser identity and the `window.__obs` correlation surface without coupling auth to an SDK. |
| Client interaction/route/error | `libs/client-app/src/shell/wall-client-env.ts` | Joins an interaction to the injected HTTP client at the wall-network composition boundary. |
| HTTP request/transport | `libs/server-app/src/app/create-server.ts` | Owns Hono request/error middleware and browser OTLP ingress. |
| HTTP request/transport | `libs/server-app/src/app/request-db-middleware.ts` | Stamps identity after auth resolves and observes request-scoped DB acquisition. |
| HTTP request/transport | `libs/server-app/src/room/route.ts` | Propagates active W3C context across the Worker-to-Durable-Object binding. |
| SQL | `libs/server-app/src/observability/wrap-sql-client.ts` | Central SQL/transaction spans and sampled sqlcommenter; repositories remain untouched. |
| Durable Object room | `pkgs/room-adapter-durable-object/src/observability.ts` | Central upgrade/message/error span policy for the generic room adapter. |
| Durable Object room | `pkgs/room-adapter-durable-object/src/adapter-base.ts` | Supplies room identity/outcomes and persists connection correlation at the adapter lifecycle boundary. |
| Sync/mutation | `pkgs/sync-engine/src/client/mutation-upload-queue.ts` | Owns batch, retry, rejection, and offline-link lifecycle spans. |
| Sync/mutation | `pkgs/sync-engine/src/mutations/client/create-mutation-client.ts` | Captures originating interaction context when the durable outbox row is created. |
| Sync/mutation | `pkgs/sync-engine/src/mutations/server/replay-mutation.ts` | Owns replay spans and writes the append-only durable correlation event. |
| Sync/mutation | `pkgs/sync-engine/src/server/sync-app-mutations-route.ts` | Stamps authenticated device/user facts on the active upload request span. |
| Sync/mutation | `pkgs/sync-engine/src/shared/mutation-observability.ts` | Centralizes the offline-origin OTel link used by upload and replay. |
| Correlated log sink | `pkgs/logger/src/logger.ts` | Uses the provider-installed log-event callback to bridge the existing logger to the active real OTel span without a runtime package dependency. |
| Test failure sink | `libs/sim-harness/src/observability/test-failure-spans.ts` | Converts failed Bun/JUnit cases into exact `app.test.id` artifact traces after the test process exits. |

The package export map exposes only `browser`, `core`, `node`, `query`, and
`worker`; there is no root or wildcard export. A package-local contract test
pins that map, while a per-file lint rule proves `core` and `query` contain no
runtime SDK imports. Repository lint also rejects old facade entrypoints, the
deleted local-file package, deep entrypoint imports, and runtime-adapter imports
from the wrong host. TypeScript path aliases do not bypass the package export
map.

## Rejected alternatives

- Keep or adapt the proprietary observability facade: rejected because it
  splits context from platform/auto-instrumented spans and recreates the OTel
  port.
- Cloudflare native traces as the sole Worker implementation: rejected by the
  inbound propagation spike and missing context-id/manual-parent APIs.
- One isomorphic runtime adapter: rejected because browser shutdown, Worker
  request lifetime, and Node async context have different correctness rules.
- Tail sampling: rejected because it loses successful requests that produced an
  incorrect result.
- Free-form logs or raw attribute strings: rejected because agent queries need a
  stable vocabulary and one correlated timeline.
- Metrics and dashboards in this migration: rejected because they do not serve
  the five required agent workflows and Worker OTLP metrics export is not yet
  supported.

## Security and operations

- Export-time attributes are default-deny. Unknown values never reach NDJSON or
  a remote collector.
- Production trace querying uses a read-only token scoped to trace search and
  retrieval. Collector/admin credentials are never exposed to agents.
- User/email resolution queries durable indexed correlation data; raw email is
  not copied into span attributes.
- SQL comments are added only for sampled traces and contain W3C context, never
  parameters or identity.
- Backend changes modify Collector/destination configuration, not application
  recording code.

## Consequences

The old observability packages and injected env fields are deleted in the same
change. Tests and simulations get OTel's global no-op unless their composition
root registers an SDK. Native and application traces may remain separate on
Cloudflare until inbound propagation ships; the durable mutation/event joins
and the application OTLP trace remain authoritative for `obs`. A future switch
back to native-only recording requires an empirical propagation regression test,
not a documentation assumption.
