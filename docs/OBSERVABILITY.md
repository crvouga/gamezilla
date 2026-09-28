# Observability

Traces are the first debugging surface — locally, in CI and in production.
Run `bun obs` before adding logs or rerunning a failure.

## `bun obs`

| Situation | Command |
| --- | --- |
| It just happened, no identifier | `bun obs last --window 10m` |
| Any trace, session, mutation, test, device or user id | `bun obs find <id>` |
| Slow behavior | `bun obs slow --since 1h --layer db` |
| An unexplained write | `bun obs mutation <mutation-id>` |
| A failing spec in CI | `bun obs test '<exact test name>' --source <downloaded-artifact>` |
| A production alert | the literal `bun obs … --source prod` command in the alert |

Every narrated answer starts with `obs/v1`, names its source and UTC range,
and ends with a suggested next command. Exit codes: `0` found, `1` no match,
`2` usage / unsupported, `3` store unreachable. `--json` is for programs.
`obs schema` lists the attributes, events and span names the source holds.

Sources:

- default, or a directory: NDJSON artifacts and OTLP `resourceSpans` JSON.
  With no `--source`, `.observability/` wins when it has artifacts; otherwise
  the newest `.cache/localhost-stack/*.json` manifest's collector.
- `--source local-explorer`: Wrangler Local Explorer (`OBS_LOCAL_EXPLORER_URL`
  when not on port 8787).
- `--source prod` / `tempo`: Tempo over HTTP with `OBS_TEMPO_URL`,
  `OBS_TEMPO_TOKEN` (read-only) and `OBS_TEMPO_USER` (Grafana Cloud Basic
  auth; without it, Bearer).

`bun obs user`, identity-shaped `find` and `tail --user` accept a username or
email when `OBS_READONLY_DATABASE_URL` is set: a role with only `SELECT` on
`profile`, `idp_users` and `pg_stat_statements` (`OBS_DATABASE_SCHEMA` picks
the schema). Only the resolved `user.id` goes to Tempo; email is never a span
attribute. The same connection feeds `slow --layer db`, which falls back to DB
spans when `pg_stat_statements` is unavailable.

`@pkgs/observability-mcp` serves the same read side as MCP tools
(`find_user_activity`, `get_trace`, `narrate_trace`,
`find_failing_test_trace`): `bun run --filter @pkgs/observability-mcp start`
with `OBS_TRACE_SOURCE` set to an artifact directory or `tempo`/`prod`.

Traces explain interactions, requests, mutation and sync chains, SQL and
failures. For CSS or layout bugs use browser tooling (with `bun obs last` for
the activity behind the render); for Solid signal wiring read the code; for
build or type errors read the compiler.

## Where traces go

- **Specs.** The harness writes each package's spans to
  `.cache/harness-report/traces/spans.ndjson`, flushing after every test. After
  a run the spec runner adds a `test.failure` trace per failed JUnit case
  (`app.test.id` = the exact test name, plus package, file and line), so a
  failure is queryable without a rerun. The Check workflow uploads the files
  as `observability-traces-<run-id>`.
- **`bun run stack`.** An in-process OTLP/HTTP JSON receiver (no Docker)
  writes to the stack's `observabilityTraceDir`; the browser exports through
  the API's same-origin ingress, so browser, Worker, sync and SQL spans land
  together. `bun stack --observability lgtm` adds Grafana/Tempo in Docker;
  `--no-observability` turns tracing off.
- **CI collector.** [`collector-ci.yaml`](../pkgs/observability/configs/collector-ci.yaml)
  (validate with `bun run --filter @pkgs/observability check:collector-configs`,
  Docker running).
- **Deployed environments.** Workers and the browser ingress export OTLP
  straight to Grafana Cloud's gateway; traces land in the one Tempo stack
  (`deployment.environment.name` tells environments apart). OpenTofu owns the
  stack, its write-only `traces:write` and read-only `traces:read` policies and
  tokens, and the secrets `OBSERVABILITY_COLLECTOR_URL` / `_USER` / `_TOKEN`
  (Worker ingest) and `OBS_TEMPO_URL` / `_USER` / `_TOKEN` (queries)
  ([`INFRA.md`](INFRA.md)). The only manual step is seeding
  `GRAFANA_CLOUD_API_TOKEN` (`bun run secrets:seed -- --env prd
  GRAFANA_CLOUD_API_TOKEN`). `specs/health/` checks ingest and query live.
  Deploy fails closed without the collector URL and write token;
  `OBSERVABILITY_ENABLED=0` is the emergency kill switch.
- **Alerts.** Install
  [`production-error-alert.txt`](../pkgs/observability/configs/production-error-alert.txt)
  in Grafana Alerting; notification targets are not stored in the repo.

Keep ingest and query authority apart: the ingest token is write-only and
lives only in the Workers (never the browser); agents get only the read-only
Tempo token; never hand an agent `GRAFANA_CLOUD_API_TOKEN` or a Grafana admin
credential.

## Recording

- OpenTelemetry's API is the only recording port. `@pkgs/observability`
  exports `core` (vocabulary, correlation, narration, span helpers), one
  runtime entrypoint each for `browser`, `worker` and `node`, and read-only
  `query`. SDK imports stay in their runtime entrypoint; query code imports
  only `query`.
- Use `withSpan` when child fetch / SQL / platform work must inherit the
  context; `using span = startSpan(...)` is for leaf work (lifetime only).
- Span names are stable lowercase `{domain}.{action}`, never with an
  interpolated id. Attributes come from `ATTR`, events from `EVENT` /
  `events`. Redaction is default-deny at export. SQL spans carry only
  parameterized statement text; sqlcommenter comments, added only to sampled
  traces, carry W3C context, never parameters or identity.
- A new event: add its constant and typed helper in `core`, use allowlisted
  `ATTR` keys, add narration coverage.
- Only boundaries record: runtime entrypoints, client interaction / route /
  error, HTTP middleware, SQL client, room adapter, sync upload and replay,
  the logger bridge and the test-failure sink. The allowlist is the
  `observability-boundary-imports.grit` entry in `biome.json`; business code
  never imports observability.
- Sampling is 100% locally and in CI; production uses head sampling. No tail
  sampling: a successful request with a wrong answer matters.
- Telemetry is not the source of truth. A mutation's id and originating
  `traceparent` are stored in the local outbox, a reconnect starts a new trace
  linked to it, and replay writes an append-only correlation event
  (`user_id`, `device_id`) in Postgres.
- Cloudflare's native tracing stays on for platform spans but does not
  continue an inbound `traceparent`, so the OTel Worker adapter carries the
  cross-stack trace.
