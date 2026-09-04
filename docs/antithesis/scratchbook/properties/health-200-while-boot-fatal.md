# health-200-while-boot-fatal

Focus: Lifecycle Transitions (startup). Claimed isolate-only health vs one-shot `ensureApp` fatal latch.

## Why this property

`handleWorkerFetch` answers `GET|HEAD /api/health` **before** `ensureApp`. A config/secret failure latches `bootState = { kind: 'fatal' }` and every later product request returns 503 `{ error: 'api misconfigured' }`, while health stays `{ status: 'ok' }` 200. The Expo client origin gate treats that 200 as “API available” and then issues `/api/query` and `/api/mutations`.

This is the startup window the focus asks for: requests during boot, plus a health signal that does not track readiness.

## Code paths

- `apps/server/src/server.ts`
  - `BootState` = `pending | ready | fatal` (lines 59–64). Isolate-local; a new Worker isolate starts `pending`.
  - `handleHealthRequest` (207–229): pathname `/api/health` only. GET → 200 JSON `{ status: 'ok' }`. HEAD → 200 empty. No `ensureApp`, no DB, no boot-state read.
  - `ensureApp` (190–205): if `ready` return app; if `fatal` return null; else `bootApp`. `ConfigurationError` / secret-store errors call `latchFatal` and return null. Other throws propagate to the top-level 500 handler.
  - `handleWorkerFetch` (251–278): health → SSO bounce → OPTIONS → `ensureApp`. `app === null` → `fatalConfigResponse` 503.
  - `latchFatal` (111–117): intended sticky for the isolate lifetime. First request that hits a config error poisons later product traffic — unless a concurrent `bootApp` overwrites `fatal` with `ready`.
- Client origin gate
  - `pkgs/http-client/src/origin-health-probe.ts` `probeHealthEndpoint`: success = HTTP 2xx **and** JSON `{ status: 'ok' }`.
  - `pkgs/http-client/src/gate-fetch-until-available.ts` `fetchAndNote`: any **completed** `fetch` (including 5xx) calls `availability.noteSuccess()`. Only thrown `HttpNetworkError` marks unavailable.
  - Product health URL: `apps/client/src/product/wall-client-env.ts` → `{serverUrl}/api/health`.
- Smoke already special-cases the 503 body (`libs/secrets/src/shared/smoke-tests.ts` `isFatalApiMisconfigured`) — operators know health can lie; the client gate does not.

## Failure scenario

1. New isolate, `bootState = pending`. Load balancer / client probe hits `/api/health` → 200 ok. Origin gate opens.
2. First product request runs `bootApp`. Missing `DATABASE_URL` / secret store error → `latchFatal`. Response 503 `api misconfigured`.
3. `gateFetchUntilAvailable` still `noteSuccess()` on that 503 (completed HTTP). Subsequent `/api/mutations` and `/api/query` keep firing against a permanently fatal isolate.
4. Concurrent first requests while `pending`: JS is single-threaded per isolate, but two in-flight `ensureApp` calls can both pass the `kind === 'pending'` check before either writes `ready`/`fatal` (no mutex around the latch). Duplicate `createServer` is the race; the second write wins — including **overwriting `fatal` with `ready`**. The Always is after in-flight boots settle: a config-error 503 must not be followed by a product 200 on that isolate (until process restart). `Unreachable(fatal then ready)` is the latch-stickiness check.

Antithesis: pause the isolate between health 200 and `ensureApp` completion; restart the API process mid-`bootApp`; leave Postgres down so `bootApp` throws a non-config error (500, not latched) while health stays 200.

## Key observations

- Health is **intentionally** isolate liveness, not readiness. The property is not “health should go 503.” It is: product routes after a fatal latch stay 503, and a health-200 origin gate will still send them.
- `noteSuccess` on completed 5xx means a fatal 503 **confirms** availability. That coupling is the Antithesis-interesting part — sim never models the health probe vs Hono split.
- Non-config `bootApp` throws do **not** latch (`ConfigurationError` is missing `SECRETS_ENV` only; secret-store errors latch). Neon connect is the request path after `ready`, not `bootApp`. Health-200 + 500/hang is `health-ok-db-down-opens-gate`.
- Cron `drainOutboxOnCron` does not go through `ensureApp` / health.

## Existing instrumentation

Missing. `existing-assertions.md`: no Antithesis SDK in the tree. No SUT-side boot-state assertion.

Suggested (all **missing**):

- `Reachable("worker-health-200-boot-pending")` at `handleHealthRequest` when `bootState.kind !== 'ready'`.
- `Always("fatal-latch-non-health-is-503", bootState.kind !== 'fatal' || status === 503)` at the `app === null` return — after overlapping `ensureApp` calls settle, not mid-boot.
- `Unreachable("boot-fatal-then-ready")` if `bootState` goes `fatal` then `ready` on the same isolate (concurrent `bootApp` overwrote the latch).
- `Sometimes("health-200-while-boot-fatal", health200 && bootState.kind === 'fatal')` as a search hint.
- Workload: after observing health 200, POST `/api/query` and assert that a fatal isolate never returns a sync `ok` snapshot.

## What goes wrong if violated

Clients treat the origin as up, queue uploads, and retry. Users see “offline” flicker or silent upload failure while ops dashboards show healthy. A false **ready** on health (if someone later “fixes” health to boot the app) would block probes on config errors and hide the latch. A false **success** on product routes after fatal (health 200 **and** `/mutations` 200) would mean the latch is broken.

## Open questions

- None

### Investigation Log

#### Can two overlapping `ensureApp` calls both run `bootApp` on one isolate?

- Examined: `apps/server/src/server.ts` `ensureApp` / `bootState` / `latchFatal` / `handleWorkerFetch`.
- Found: checks are `if (ready) return; if (fatal) return null;` then `await bootApp`. No mutex. Two in-flight fetches can both observe `pending` and both run `bootApp`. Last assignment wins. A later success can overwrite `fatal` with `ready`.
- Not found: a boot lock or “once fatal, stay fatal” write barrier.
- Conclusion: resolved — yes. Property changed: Always after both boots settle; add `Unreachable(fatal then ready)` so a raced overwrite is a finding, not a vacuous pass.

#### Do non-config `bootApp` throws (DB down) ever get classified as `ConfigurationError`?

- Examined: `ConfigurationError` (`assertSecretsEnvBinding` only); `isSecretStoreError` latch; `bootApp` (`openSqlClient` is a factory, not invoked during boot); `openRequestDb` on the request path.
- Found: `ConfigurationError` is missing `SECRETS_ENV`. Missing `DATABASE_URL` is a secret-store error (latches). Neon connect happens in request middleware after `ready`, not in `bootApp`. Connect throw is a generic 500; `bootState` stays `pending` if it happened during boot, or `ready` if boot already succeeded.
- Not found: a path that wraps `ECONNREFUSED` / timeout as `ConfigurationError`.
- Conclusion: resolved — connect failures do not latch. Health-200 + 500/hang is `health-ok-db-down-opens-gate`, not this property.

#### Is `noteSuccess` on 503 the intended product behavior, or an oversight?

- Examined: `fetchAndNote`; `health/route.ts` liveness comment; `libs/secrets` `isFatalApiMisconfigured` (ops treat 503 as fatal).
- Found: implemented behavior is `noteSuccess` on any completed Response. Smoke tests already special-case the fatal 503 body; the client gate does not. No comment claims 5xx should confirm availability.
- Not found: a product spec that 503 is “API up.”
- Conclusion: resolved for this property — keep “gate may open; product routes stay 503.” Gate-storm belongs on `health-ok-db-down-opens-gate`. Do not require this property to also close the gate.

SDK (`existing-assertions.md`): **missing**. Suggested Reachable / Always / Sometimes / Unreachable are new. No SUT-side boot-state assertion exists.
