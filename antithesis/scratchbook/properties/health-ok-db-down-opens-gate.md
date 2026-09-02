# health-ok-db-down-opens-gate

Focus: Failure Recovery. Confidence: high.

## Claim to test (not a fact)

`GET /api/health` returning HTTP 200 `{ status: 'ok' }` is isolate liveness only — it does not mean Postgres (or boot) can serve sync. Clients that treat that body as origin-available must not enter a zero-delay mutation/query retry loop when the write path is down, and must resume a bounded drain when Postgres returns.

Completed **5xx** on `/api/mutations` currently still call `noteSuccess()` (any finished `fetch` is “success”). Only a **thrown** `HttpNetworkError` marks the origin unavailable. That split is the retry-storm window.

## Why this property

SUT analysis: “Health lies: `/api/health` is 200 while boot is fatal, Postgres is down, or EMQX is down. Client origin gate treats 2xx `{status:'ok'}` as available.” Failure-prone area #7. No circuit breakers; recovery is backoff + 30s reconcile.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Failure scenario

1. Worker process is up. `handleHealthRequest` returns 200 JSON **before** `ensureApp` and without opening SQL.
2. Client `createHealthOriginAvailability` probe: `res.ok && json.status === 'ok'` → `phase = 'available'`. `waitUntilAvailable` unblocks the upload queue.
3. `POST /api/mutations` / `/api/query` hit `createRequestDbMiddleware` (health is the only path that skips DB). Postgres is down, hung (no connect timeout), or boot is latched fatal (non-health routes 503 `{ error: 'api misconfigured' }` while health stays 200).
4. If the Worker still writes a 500/503 Response:
   - `gateFetchUntilAvailable.fetchAndNote` calls `noteSuccess()` — gate stays **available**.
   - `postAuthedJson` throws a generic `Error` (not `HttpNetworkError`) on `!response.ok`.
   - Upload queue takes the error-backoff branch (2s … 60s), not `waitUntilAvailable`.
5. If `fetch` itself throws (isolate restart mid-POST, connection reset):
   - `noteNetworkFailure()` → unavailable.
   - Upload waits on `waitUntilAvailable`.
   - Next health probe is immediately 200 → available → tight retry.

Case 5 is the storm. Case 4 is a coordinated hammer on every health-ok flap. Case hang: request `openPgClient` has no `connectionTimeoutMillis` (`pingPostgres`’s 10s timeout is not on this path); uploads sit in-flight with the gate open.

## Code paths

| Path | Role |
|---|---|
| `apps/server/src/server.ts` `handleHealthRequest` / `handleWorkerFetch` | Health short-circuit: no boot, no DB. Fatal boot → 503 for other routes; health still 200. |
| `apps/server/src/health/route.ts` | Hono `/health` also `{ status: 'ok' }` 200 (reached only if the request was *not* short-circuited — same body). |
| `apps/server/src/app/request-db-middleware.ts` | `/api/health` skips DB attach. |
| `apps/client/src/product/wall-client-env.ts` | `createHealthOriginAvailability({ healthUrl: …/api/health })` + `gateFetchUntilAvailable`. |
| `pkgs/http-client/src/origin-health-probe.ts` `probeHealthEndpoint` | Success = HTTP 2xx **and** JSON `status === 'ok'`. |
| `pkgs/http-client/src/origin-availability.ts` `noteSuccess` / `noteNetworkFailure` | Success forces `available` and resolves waiters. |
| `pkgs/http-client/src/gate-fetch-until-available.ts` `fetchAndNote` | Every completed Response → `noteSuccess()`. Thrown network → `noteNetworkFailure()`. Health URL bypasses the gate. |
| `pkgs/sync-engine/src/client/sync-http-client.ts` `postAuthedJson` | 401/429 typed; other `!ok` → generic `Error`. |
| `pkgs/sync-engine/src/client/mutation-upload-queue.ts` | `HttpNetworkError` + `waitUntilAvailable` → no timed backoff; other errors → `ERROR_DELAY_MS` exponential. |
| `libs/secrets/src/shared/smoke-tests.ts` / `tools/scripts/wait-for-api-health.ts` | Ops also treat health-ok as “API is up.” |

## What goes wrong if violated

Clients hammer `/mutations` and `/query` against a Worker that cannot reach Neon: retry storm, lock pile-up when DB returns, dropped in-flight applies that look like lost-ack. Users see `online: true` (health) while every write fails. Isolate restart mid-upload plus health-ok is the same messy state as `crash-after-apply-before-ack` with a faster retry.

## SUT instrumentation (all missing)

Availability / retry **outcomes** (not “entered health handler”):

- `Reachable` — health 200 served while request-DB open would fail (`api.health.ok_db_unavailable`). Needs a SUT-side check that does *not* run on the health path today — e.g. last DB open error latch sampled at health time, or a side channel.
- `Reachable` — `noteSuccess` after a non-2xx origin Response (`http.gate.success_on_http_error`).
- `Reachable` — `noteNetworkFailure` then health probe immediately re-opens (`http.gate.reopen_from_health`).
- `Reachable` — upload `HttpNetworkError` path took `waitUntilAvailable` (`sync.upload.wait_available`).
- `Reachable` — upload generic-error backoff (`sync.upload.error_backoff`).

Safety:

- `Always` — no two failed mutation POSTs for the same pending batch occur with inter-attempt delay < `ERROR_DELAY_MS` unless a successful 2xx ack landed between them.
- `Unreachable` — tight loop: fail → waitUntilAvailable resolves in < 50ms → POST again, while health is 200 and DB is down.
- `Sometimes(cond)` — health-ok **and** a mutations 5xx/throw observed in the same window (`origin.split_brain_health_vs_db`).
- `Sometimes(cond)` — after DB returns, a pending queue drains to empty (`sync.upload.drain_after_db_heal`).

## Open questions

- None

## Related

- `crash-after-apply-before-ack` — isolate death mid-upload is one way to enter the thrown-fetch + health-ok retry path.
- `outbox-processed-without-notify` — health-ok + EMQX-down is the notify sibling of health-ok + DB-down.

## Synthesis merge (orchestrator)

Also covers: `mutation-upload-no-retry-storm-health-lie`. Same origin-gate lie. `health-200-while-boot-fatal` stays separate (boot latch vs DB-down).

### Investigation Log

#### When Postgres is unreachable, does `openRequestDb` throw (500) or hang?

- Examined: `apps/server/src/db/open-request-db-postgres.ts`; `pkgs/sql-client/src/postgres/connect.ts` `openPgClient`; `ping.ts` (`PING_CONNECT_TIMEOUT_MS = 10_000`); `handleWorkerFetch` top-level 500; `request-db-middleware.ts`.
- Found: request `openPgClient` constructs `new PgClient({ connectionString })` with no `connectionTimeoutMillis`. `pingPostgres` (10s timeout) is not on the request path. `client.connect()` can hang on a blackhole / hung Neon. Fast refuse/reset throws into `handleWorkerFetch` → 500 JSON (completed Response → `noteSuccess()`).
- Not found: a request-path connect timeout or circuit breaker.
- Conclusion: resolved — both happen. Property must cover stall (in-flight hang, gate open) and storm (5xx + `noteSuccess`, or thrown fetch + health-ok reopen).

#### Does fatal-boot 503 keep `noteSuccess` true?

- Examined: `gate-fetch-until-available.ts` `fetchAndNote`; `origin-availability.ts` `noteSuccess`; `fatalConfigResponse`.
- Found: any completed `fetch` (including 503) calls `noteSuccess()`. Only thrown `HttpNetworkError` marks unavailable.
- Not found: a status-code check on the gate.
- Conclusion: resolved — yes, 503 confirms availability. Same mechanism as mutations 5xx. Distinct property remains `health-200-while-boot-fatal` (latch vs DB-down).

#### Should the property require health to stay liveness-only, or only require bounded backoff?

- Examined: `apps/server/src/health/route.ts` comment “liveness for load balancers and deploy checks”; `handleHealthRequest` (no boot, no DB); `probeHealthEndpoint` (2xx + `status === 'ok'`); smoke `isFatalApiMisconfigured`.
- Found: server documents isolate liveness. Client gate treats that body as origin readiness. Catalog already asserts bounded backoff / no tight loop, not “health must go 503.”
- Not found: a claim that health is readiness.
- Conclusion: resolved — property stays “health may stay dumb; client must not tight-loop.” Do not flip this into a readiness-probe rewrite. `Sometimes(origin.split_brain_health_vs_db)` is the search hint that the lie occurred.

SDK (`existing-assertions.md`): **missing**. All suggested Reachable / Always / Unreachable / Sometimes are new.
