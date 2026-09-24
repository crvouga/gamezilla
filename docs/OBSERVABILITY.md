# Observability

OpenTelemetry is the recording API. Runtime entrypoints in
`@pkgs/observability/{browser,worker,node}` install the appropriate SDK and
export over OTLP; application code uses `@pkgs/observability/core`. The
Collector/backend is configuration, not application code.

Use `withSpan` when instrumented fetch, SQL, or other child work must inherit an
active context. `using span = startSpan(...)` guarantees lifetime only and is
for leaf work. Attributes come from `ATTR`, events from `EVENT`/`events`, and
span names are stable lowercase `{domain}.{action}` names. Never interpolate an
identifier into a span name. Ingest redaction is an allowlist.

## Agent workflow

Start with traces before adding logs or rerunning a failure:

```sh
bun obs last --window 10m
bun obs find <trace-session-mutation-test-user-or-device-id>
bun obs test '<test name>' --source artifacts
bun obs slow --since 1h --layer db
```

Every narrated response starts with `obs/v1`, identifies its source and UTC
range, and ends with a suggested next command. Exit codes are stable: `0` found,
`1` no match, `2` usage/unsupported operation, `3` unreachable store. Use
`--json` only for programmatic processing.

Sources are interchangeable:

- Default or a directory path: normalized NDJSON artifacts and OTLP Collector
  `resourceSpans` JSON.
- `--source local-explorer`: Wrangler Local Explorer; configure
  `OBS_LOCAL_EXPLORER_URL` when it is not on port 8787.
- `--source prod` or `--source tempo`: Tempo HTTP API using the read-only
  `OBS_TEMPO_URL` and optional `OBS_TEMPO_TOKEN`. Set `OBS_TEMPO_USER` with
  that token for Grafana Cloud Basic authentication; a token without a user
  uses Bearer authentication. A user without a token is rejected.

With no `--source`, `.observability` NDJSON wins when it contains artifacts.
Otherwise `bun obs` reads `.cache/localhost-stack/*.json` and selects the
newest valid manifest (stable instance-id tie-break). It reads the native
collector's NDJSON directory directly, or its dynamic Tempo origin when the
optional LGTM backend is running.

`bun obs user`, identity-shaped `find`, and `tail --user` accept username or
email when `OBS_READONLY_DATABASE_URL` is set. Use a dedicated database role
with only `SELECT` on `profile`, `idp_users`, and `pg_stat_statements`; optional
`OBS_DATABASE_SCHEMA` selects the application schema. The resolver queries
those identity facts first and sends only the resulting durable `user.id` to
Tempo. The same connection powers `slow --layer db`; when the extension or
grant is unavailable, the command says so and retains its database-span
fallback.

## Collectors and credentials

`bun run stack` defaults to a native, in-process OTLP/HTTP JSON receiver. It
starts in milliseconds, writes standard OTLP documents to the stack's
`observabilityTraceDir`, and requires no Docker daemon. The API nodes receive
its exact `observabilityCollectorUrl`; the browser exports through the API's
same-origin ingress, so browser, Worker, sync, and database spans land in the
same queryable artifact stream.

Use `bun stack --observability lgtm` when a local Grafana/Tempo UI is useful.
That explicit mode boots the pinned `grafana/otel-lgtm` image and publishes
`observabilityTempoUrl` and `observabilityGrafanaUrl`; it requires Docker.
Use `--no-observability` only when tracing is intentionally outside the task.

CI uses [`collector-ci.yaml`](../pkgs/observability/configs/collector-ci.yaml):
100% OTLP ingest, ingest allowlisting, and newline-delimited OTLP JSON at
`OBSERVABILITY_ARTIFACT_PATH`. Validate it with
`bun run --filter @pkgs/observability check:collector-configs` while Docker is
running.

## Production: Grafana Cloud

Production has no self-hosted Collector. Both Workers and the browser ingress
export OTLP/HTTP straight to the Grafana Cloud OTLP gateway; the SDK's
`RedactingSpanProcessor` applies the same default-deny attribute allowlist
before export. Traces land in the stack's Tempo.

`@libs/observability#provision` (part of `bun run deploy`, `prd` only)
reconciles everything from one bootstrap credential, `GRAFANA_CLOUD_API_TOKEN`:

- the stack (`PRODUCT_CONFIG.observability.grafanaStackSlug`, created if
  missing),
- a write-only `traces:write` access policy and a read-only `traces:read`
  policy scoped to that stack,
- tokens for both (kept while they still authenticate, rotated otherwise),
- the secrets `OBSERVABILITY_COLLECTOR_URL` / `_USER` / `_TOKEN` (Worker
  ingest, Basic auth) and `OBS_TEMPO_URL` / `_USER` / `_TOKEN` (agent queries),
  written to secrets env `prd`.

One-time setup: in Grafana Cloud create an access policy on your org realm
with `stacks:read`, `stacks:write`, `accesspolicies:read`,
`accesspolicies:write`, `accesspolicies:delete`, add a token, then run

```sh
bun run secrets:seed -- --env prd GRAFANA_CLOUD_API_TOKEN
```

`secrets:seed` prompts with echo off, validates, and writes to Infisical; with
no names it walks every missing manual secret in the registry.

`bun run smoke:prd` (and the hourly `smoke.yml`) verifies it live:
`@libs/observability#smoke` checks the ingest endpoint shape, that the write
token can ingest, and that the read token can query Tempo.

Keep ingest and query authority separate:

- `OBSERVABILITY_COLLECTOR_URL` is the exact HTTPS production ingest endpoint
  ending in `/v1/traces`; `OBSERVABILITY_COLLECTOR_TOKEN` is write-only and is
  available only to the Workers. With `OBSERVABILITY_COLLECTOR_USER` set the
  Workers send Basic auth, otherwise Bearer (local / CI Collector). The browser
  never receives either.
- `OBS_TEMPO_URL` is the Tempo query origin used by `bun obs --source prod`.
  `OBS_TEMPO_TOKEN` belongs only in the agent/CI query environment and must be
  a read-only token. `OBS_TEMPO_USER` is Grafana Cloud's stack/user id and
  switches the query client to Basic authentication. For Grafana Cloud,
  provision a dedicated access policy
  with only `traces:read`; for self-managed Tempo, terminate authentication in
  a reverse proxy because Tempo itself has no authentication layer.
- Never reuse the ingest token for agent queries, and never expose
  `GRAFANA_CLOUD_API_TOKEN` or a Grafana administrator credential to an agent.

Production alerting systems use
[`production-error-alert.txt`](../pkgs/observability/configs/production-error-alert.txt).
It hands the agent a copy-pasteable `bun obs trace … --source prod` command and
an identifier-free fallback. Install that template in Grafana Alerting; notification
targets are intentionally not stored in this repository. Production deployment fails
closed when the Collector URL or write token is absent. Set
`OBSERVABILITY_ENABLED=0` only as the explicit emergency kill switch.

The Bun sim harness writes each package's e2e spans to
`.cache/sim-report/traces/spans.ndjson` and force-flushes after every test with
a two-second ceiling, including failed tests. PR CI uploads those files as the
`observability-traces-<run-id>` artifact and prints download/query commands in
the failure summary. Bun's hooks do not currently expose a stable full test ID
to preloads. The shared e2e runner therefore treats JUnit as the authoritative
identity map and appends a deterministic `test.failure` trace after the run for
every failed testcase. Its exact testcase name is `app.test.id`, with package,
file, and line correlation. Consequently an ordinary test-body assertion is
queryable as `bun obs test '<exact test name>' --source <artifact>` without a
rerun, even when Bun executed the suite in parallel. Explicit `OBS_TEST_ID`
still labels spans created during a deliberately single-test process.

`obs schema` derives attributes, events, and span names from the selected live
source. Username/email resolution must happen through a read-only application
identity lookup before querying `user.id`; email is intentionally excluded from
trace attributes by the PII allowlist.

`@pkgs/observability-mcp` exposes the same read side as four transport-neutral
MCP tool handlers: `find_user_activity`, `get_trace`, `narrate_trace`, and
`find_failing_test_trace`. They return versioned narration and next actions,
never raw span dumps. Run the repository's MCP 2026 stdio server with
`bun run --filter @pkgs/observability-mcp start`; set `OBS_TRACE_SOURCE` to an
artifact directory or to `tempo`/`prod`, with the same read-only Tempo
credentials used by `obs`. Tempo's built-in MCP remains the general TraceQL
surface.

## Boundaries

Traces explain interactions, requests, mutation/sync chains, SQL, and failures.
Use browser tooling and screenshots for CSS/layout issues, code reading for
Solid signal wiring, and compiler output for build/type failures. The trace is
still useful beside those tools to identify the activity that produced state.

Authenticated sync identity is authoritative on the active request span and
the append-only database event row (`user_id`, `device_id`). It is not installed
as request Baggage after route authentication: OTel Context is immutable, and
replacing context inside a route would not update the already-active upstream
Hono middleware context. Downstream replay instead inherits the active request
span, while durable correlation travels explicitly in the mutation envelope.

When adding an event, add its constant and typed helper in core, use only
allowlisted `ATTR` keys, and add narration coverage. Runtime-specific SDK imports
stay inside their runtime entrypoint. Query code imports only
`@pkgs/observability/query`.

The exact manual-instrumentation footprint is 20 production source files across
seven conceptual boundaries. The complete file-by-file inventory and the reason
for exceeding the brief's seven-file target are recorded in
[`0001_OBSERVABILITY.md`](adr/0001_OBSERVABILITY.md#boundary-file-inventory).
