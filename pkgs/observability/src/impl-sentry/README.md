# impl-sentry

Adapter mapping `@pkgs/observability/port` to Sentry Performance (`@sentry/react-native` on client, `@sentry/cloudflare` on Workers).

Sentry is **dormant by default**. DSN secrets alone do not activate it.

## Client (synced `client_config`)

The Worker materializes:

| `client_config` id | Source secret | Payload |
| --- | --- | --- |
| `sentry` | `EXPO_PUBLIC_SENTRY_DSN` | `{ "dsn": "…" }` when set |
| `observability` | `EXPO_PUBLIC_OBSERVABILITY_BACKEND` | `{ "backend": "noop"\|"sentry"\|"console" }` (default `noop`) |

The client initializes Sentry after sync paint via `useClientConfig` / `AppObservabilityFromClientConfig`. Do not bake these into Expo `EXPO_PUBLIC_*` env.

## API Worker

| Secret / env | Purpose |
| --- | --- |
| `SENTRY_DSN` | `Sentry.withSentry` + server adapter |
| `OBSERVABILITY_BACKEND=sentry` | Required to enable Sentry on the Worker |
| `SENTRY_AUTH_TOKEN` | Scripts only (`bun run client:sentry-dsn`) |

Populate DSN secrets via:

```bash
bun run client:sentry-dsn
```

Restart the API so `client_config` rematerializes; the client picks rows up via sync. Set `EXPO_PUBLIC_OBSERVABILITY_BACKEND=sentry` in the Worker secret store when you want client Sentry active.

## Instrumented operations

Existing port instrumentation exports to Sentry Performance when the sentry backend is active:

- `http.client.request` — sync fetch on client
- `http.server.request` — all `/api/*` routes on Workers
- `db.query` / `db.transaction` — Postgres (API) and SQLite (client)
- `sync.upload` — sync upload handler on API

Slow spans are tagged with `performance.slow=true` when duration exceeds defaults in `shared/slow-thresholds.ts` (override via `OBSERVABILITY_SLOW_MS_<SPAN_NAME>`).

## Local-file override (API / scripts)

`local-file` remains available for offline NDJSON capture on the API. Start the collector
explicitly (it is not part of root `bun dev`):

```bash
bun run --filter @pkgs/observability collector
OBSERVABILITY_BACKEND=local-file bun run --filter @apps/api …
bun run --filter @pkgs/observability summarize
```
