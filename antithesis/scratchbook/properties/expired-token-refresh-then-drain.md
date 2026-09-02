# expired-token-refresh-then-drain

Focus: Failure Recovery (claimed liveness A14). Complement of `unclassified-401-defaults-expired` (wipe classification only) and of `mqtt-http-independent-fault-domains` (HTTP heal assumes a bearer the server still accepts).

## Claim to test (not a fact)

After a session is expired (clock past `idp_sessions.expires_at`, or a 401 `{ reason: 'expired' }`), a client that later holds a **valid** bearer eventually uploads the durable `sync_engine_mutations` queue. Expired 401s do not wipe. The 4s `raceFreshToken` timeout falling back to a stale bearer must not permanently stall the queue once a usable token exists.

SUT `[liveness]`: “Expired token refreshes; queued mutations then drain.” A14: partition during the 4s refresh. Topology clock jump lists “OAuth TTL, 4s token refresh.”

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Why this property

Sim implements the claim with `withSimAuthRetry` + `refreshExpired()` (`pkgs/sync-engine/src/sim/client-factory-parts.ts`). Product does not remint: `@pkgs/auth` `getFreshToken` is `bearerStore.read()`, and `useGetFreshAuthToken` is that port. `POST /identity/refresh` upserts device snapshot and **requires a live bearer**; 401/403 clears capability (`isUnauthorizedRefreshError`) and falls through to anon — it does not insert a new `idp_sessions` row.

IdP tokens are opaque `createId()` strings (`createSession`), not JWTs. `sessionTokenLikelyValid` treats `parts.length < 2` as invalid, so every product sync POST races `getFreshAuthToken` with `FRESH_TOKEN_TIMEOUT_MS = 4_000` then falls back to `getSessionToken()`. A hang or partition of the store read hits A14 on **every** upload, not only after TTL.

Server expiry is real: `findSessionByToken` returns null when `expires_at <= clock.now()` (`AUTH_SESSION_TTL_MS = 30d`). `resolveSessionReplayAuth` then emits `{ error: 'auth', reason: 'expired' }`. Client retries once with `skipCache: true`; same stored token still 401s; `SyncApiAuthError('expired')` is not `HttpNetworkError` → upload takes `ERROR_DELAY_MS` backoff and retries the **same** token forever unless something remints (oauth-dev / e2e `/identity/e2e/sign-in` / a later successful exchange).

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/client/sync-http-client.ts` `FRESH_TOKEN_TIMEOUT_MS`, `raceFreshToken`, `resolveBearerToken`, `postAuthedJson` | 4s race; 401 → skipCache retry once; classify expired vs revoked vs upgrade_required. |
| `pkgs/auth/src/client/create-auth-client-adapter.ts` `getFreshToken` | Store read only. |
| `libs/auth/src/public/use-fresh-auth-token.ts` `useGetFreshAuthToken` | Product host wires the port (same read). |
| `pkgs/auth/src/server/idp-repository.ts` `createSession` / `findSessionByToken` | TTL 30d; expired hash → null. |
| `apps/server/src/sync/query-auth.ts` `resolveSessionReplayAuth` | Missing/failed session → `expired`. |
| `pkgs/sync-engine/src/client/mutation-upload-queue.ts` | `SyncApiAuthError` → error backoff, not `waitUntilAvailable`. |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` `handleError` | expired → `online: false`; wipe only if `isAuthRevoked`. |
| `pkgs/sync-engine/src/tests/scenarios/auth-revoked-wipes-db-expired-refreshes.sim.test.ts` | Sim pin: expired refreshes; held queue drains. |

## Failure scenario

1. Client queues domain mutations offline (or with a live token). `sync_engine_mutations` is non-empty.
2. Clock jump past `expires_at`, or workload `UPDATE idp_sessions.expires_at`, or pause `getFreshToken` > 4s so `raceFreshToken` returns null and the POST uses the stale store snapshot.
3. `POST /api/mutations` / `/query` → 401 `expired`. Second attempt (`skipCache`) still sends the same opaque token.
4. **Bug if** `deleteDatabase` runs (A5 / wrong host `isAuthRevoked`). **Bug if**, after a **new** valid session exists (re-OAuth, e2e remint, or a host that actually remints), the pending ids never appear in `sync_engine_mutations_applied` and the writer’s domain never matches Postgres.
5. **Bug if** the 4s timeout + stale bearer is treated as terminal (queue stopped, not backed off).

First topology: Node clients, oauth-dev / e2e remint, clock jump. No OPFS. Two clients: alice expires and remints; bob observes the drained rows after HTTP heal.

## What goes wrong if violated

Local writes look durable, then the device is “online” (health 200) while every upload is 401 expired. Peers never see the edits. A wipe would also destroy the queue (`unclassified-401` already forbids that). Sim settle hides this because `refreshExpired()` flips the knob without a 30-day clock or a store-only `getFreshToken`.

## SUT instrumentation (all missing)

- `Always` — 401 `expired` does not call `revokeDatabase` / `deleteDatabase`.
- `Always` after a later request that the server accepts (new or still-valid session): pending ids from before expiry are in `mutations_applied` (or the queue is empty and Postgres domain matches the writer).
- `Sometimes(auth.refresh.race_timeout_stale_bearer)` — `raceFreshToken` resolved null and a POST still went out with `getSessionToken()`.
- `Sometimes(auth.expired_401_then_valid_drain)` — expired 401 observed, then a 2xx mutations ack for a previously pending id.
- `Reachable` — `findSessionByToken` returned null because `expires_at` was in the past.
- `Unreachable` — upload loop stopped with a non-empty queue after a valid bearer is in the store and HTTP is up.

## Open questions

- Can the tenant jump clock ≥ `AUTH_SESSION_TTL_MS` (30d), or must the workload shorten TTL / update `expires_at`? `(partial: topology lists OAuth TTL as a clock-jump target; no tenant max in-tree; workload can UPDATE expires_at)`

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Will the headless client image remint on expiry (oauth-dev / e2e), or only call store-read `getFreshToken`?

- Examined: `pkgs/auth/src/client/create-auth-client-adapter.ts` `getFreshToken`; `libs/auth/src/root/server/auth-routes.ts` `POST /identity/refresh`; `libs/auth/src/root/server/refresh-auth-snapshot.ts`; `apps/server/src/auth/auth-routes.ts` `/identity/e2e/sign-in`; `antithesis/scratchbook/deployment-topology.md` client image; `pkgs/sync-engine/src/sim/client-factory-parts.ts` `refreshExpired`.
- Found: product `getFreshToken` is `bearerStore.read()` only. `POST /identity/refresh` upserts device/external-account rows and **requires a live bearer** — it does not insert `idp_sessions`. Headless image is a **new Dockerfile** wrapping `createClient` / the same adapter. Remint exists only as workload-driven oauth-dev `signIn` or (when `secretsEnv === 'dev'`) `POST /identity/e2e/sign-in`. Sim `refreshExpired()` is not on the product path.
- Not found: a headless wrapper that remints on 401 expired. Setup Dockerfile is not written.
- Conclusion: resolved — the image will only store-read unless setup invents a remint wrapper (not in tree). Workload must remint (oauth-dev / e2e). Property stays “after a later valid bearer exists, the queue drains”; it is not “product auto-refreshes.”

#### Can the tenant jump clock ≥ `AUTH_SESSION_TTL_MS` (30d), or must the workload shorten TTL / update `expires_at`?

- Examined: `pkgs/auth/src/shared/auth-constants.ts` `AUTH_SESSION_TTL_MS`; `idp-repository.ts` `createSession` / `findSessionByToken`; topology “Faults this topology can see” clock-jump list; `findSessionByToken` expiry compare is `expires_at <= clock.now()`.
- Found: TTL is a hardcoded 30d add on insert. Topology lists clock jump for “OAuth TTL, 4s token refresh” with no documented cap. Workload `UPDATE idp_sessions.expires_at` (or a short insert TTL) also produces a real expired 401 without a 30d jump.
- Not found: a tenant or setup file that forbids ≥30d jumps, or a product knob to shorten TTL.
- Conclusion: tagged `(partial: topology lists OAuth TTL as a clock-jump target; no tenant max in-tree; workload can UPDATE expires_at)` — either trigger works; pick at setup.

#### If product never remints, is “queue drains after remint” still the intended contract, or is re-OAuth the only recovery?

- Examined: `getFreshToken`; `POST /identity/refresh`; `mutation-upload-queue.ts` `SyncApiAuthError` backoff; SUT `[liveness]` wording in this file.
- Found: expired 401s retry the **same** opaque token with `ERROR_DELAY_MS` backoff. Nothing in product mints a replacement session. Recovery in-tree is a new OAuth ceremony or e2e remint. The liveness claim is “after a valid bearer exists, drain” — remint is the workload’s job, not `getFreshToken`.
- Not found: a silent refresh that recreates `idp_sessions` from an expired token.
- Conclusion: resolved — re-OAuth / e2e remint is the only recovery. The property’s drain half still holds as a claim to test after that remint. Not invalidated.
