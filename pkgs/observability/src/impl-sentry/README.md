# impl-sentry

Adapter mapping `@pkgs/observability/port` to Sentry Performance (`@sentry/react-native` on client, `@sentry/cloudflare` on Workers).

Sentry is **dormant by default**. DSN secrets alone do not activate it.

## Defaults (without explicit backend)

| Surface | Dev | Prod |
| --- | --- | --- |
| Client | `local-file` | `logger` |
| API | `local-file` | `logger` |

## Opt-in activation

Set `OBSERVABILITY_BACKEND=sentry` (API) and `EXPO_PUBLIC_OBSERVABILITY_BACKEND=sentry` (client), plus DSN secrets:

| Secret / env | Surface | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SENTRY_DSN` | Client | `Sentry.init` + client adapter |
| `EXPO_PUBLIC_OBSERVABILITY_BACKEND=sentry` | Client | Required to enable Sentry |
| `SENTRY_DSN` | API Worker | `Sentry.withSentry` + server adapter |
| `OBSERVABILITY_BACKEND=sentry` | API Worker | Required to enable Sentry |
| `SENTRY_AUTH_TOKEN` | Scripts only | `bun run client:sentry-dsn` |

Populate DSN secrets via:

```bash
bun run client:sentry-dsn
bun run --filter @apps/client setup
```

Then set the backend env vars above when you want to smoke-test Sentry.

## Instrumented operations

Existing port instrumentation exports to Sentry Performance when the sentry backend is active:

- `http.client.request` — patch-db sync fetch on client
- `http.server.request` — all `/api/*` routes on Workers
- `db.query` / `db.transaction` — Postgres (API) and SQLite (client)
- `patch-db.read` / `patch-db.write` — sync host on API

Slow spans are tagged with `performance.slow=true` when duration exceeds defaults in `shared/slow-thresholds.ts` (override via `OBSERVABILITY_SLOW_MS_<SPAN_NAME>`).

## Local-file override

`local-file` remains available for offline NDJSON capture:

```bash
EXPO_PUBLIC_OBSERVABILITY_BACKEND=local-file bun dev
bun run --filter @pkgs/observability summarize
```
