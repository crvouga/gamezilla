# unclassified-401-defaults-expired

Focus: Protocol Contracts. Lead: SUT analysis “401 malformed body defaults to expired not revoked.” Response codes that mask errors: every sync protocol/auth failure is HTTP 401 with `{ error: 'auth', reason }`. The client’s default when `reason` is missing or the body is not JSON is **expired**, not **revoked**.

## Claim

A 401 on `POST /api/query` or `POST /api/mutations` wipes the identity SQLite **only** when the JSON body has `reason === 'revoked'`. Any other 401 — empty body, HTML from a proxy, `{ error: 'unauthorized' }` from IdP routes, parse failure, or `reason: 'expired'` — is classified **expired**: refresh once, keep the durable mutation queue. `upgrade_required` is the only other recognized reason (see `protocol-cut-not-revoked`).

## Code paths

- `pkgs/sync-engine/src/client/sync-http-client.ts` `postAuthedJson` (401 branch):

```
const json = (await response.json().catch(() => ({}))) as { reason?: unknown };
if (json.reason === 'upgrade_required') throw new SyncApiAuthError('upgrade_required');
throw new SyncApiAuthError(json.reason === 'revoked' ? 'revoked' : 'expired');
```

  Comment: “Malformed 401 bodies still map to auth errors (operating, not programmer).” Default is expired.

- `apps/client/src/sync/create-local-sync-engine.ts` — `isAuthRevoked` is `SyncApiAuthError && reason === 'revoked'` only.
- `pkgs/sync-engine/src/client/create-local-sync-engine.ts` `handleError` — revoke ⇒ `deleteDatabase()`; else `lastError` + `online: false`.
- Product sync resolver `apps/server/src/sync/query-auth.ts` — missing session or thrown `resolveAuthContext` → `{ error: 'auth', reason: 'expired' }` only. **Never `revoked`.**
- IdP routes (`pkgs/auth/src/server/auth-route-handlers.ts`) return `{ error: 'unauthorized' }` 401 — no `reason`. If that shape were ever forwarded or confused with a sync 401, the sync client would still default to expired.
- Protocol gate (`assertSyncProtocol`) also uses 401 + `upgrade_required` (same status, different reason).
- Sim injects `revoked` via `withSimAuthRetry` throwing `SyncApiAuthError('revoked')` **without** going through the 401 body parser. The wipe pin does not exercise a malformed HTTP body.

No unit test asserts the `json().catch(() => ({}))` → expired default.

## Failure scenario

1. **Proxy / Worker HTML 401.** Cloudflare or a sidecar returns 401 `text/html` or `{ error: 'unauthorized' }`. `response.json()` throws or yields no `reason` → `expired`. Refresh loop; queue held. **Correct vs wipe.** Violation would be treating any 401 as revoke (A5).
2. **True revoke body stripped.** If a future (or sim-only) server emitted `reason: 'revoked'` and a middlebox dropped the body, the client would **not** wipe. That is the documented default. The property is the classification, not “revoke always wipes under faults.”
3. **Protocol cut body stripped.** `upgrade_required` 401 with an empty body becomes `expired`. Client refreshes the token and retries the **same** v3-or-missing header forever. No wipe (good) but also no distinct `upgrade_required` signal (see protocol-cut property).
4. **Product never emits revoke.** Repo-wide, `reason: 'revoked'` appears only in README. Live 401s from `resolveSessionReplayAuth` are expired. The wipe path is host-injected. Antithesis should still send a well-formed `revoked` 401 and a malformed 401 to prove the parser fork.

## Why Antithesis

Sim auth is a status enum on the HTTP wrapper, not a real 401 JSON parse. Antithesis can return 401 with empty/HTML/partial JSON, interleave refresh timeout (4s `raceFreshToken`), and observe whether `deleteDatabase` ran. That is the masking: HTTP 401 looks like “you are logged out” while the body (or its absence) chooses wipe vs retry.

## Instrumentation

`existing-assertions.md`: no Antithesis SDK. Suggested assertions are **missing**:

- `Always`: 401 whose body is not `{ reason: 'revoked' }` does not call `deleteDatabase` / `revokeDatabase`.
- `Always`: 401 + `reason: 'revoked'` (well-formed) does call wipe (when the host `isAuthRevoked` is the product predicate).
- `Reachable`: 401 with empty body, HTML body, and `{ error: 'unauthorized' }`.
- `Unreachable`: wipe from `upgrade_required` or from `json()` failure.

In-house substitutes: `auth-revoked-wipes-db-expired-refreshes.sim.test.ts` (injected reasons, not malformed HTTP).

## Open questions

- Should a future product revoke (sign-out all devices / stolen session) use sync 401 `reason: 'revoked'`, or a dedicated channel? If revoke stays sim-only, the wipe branch is untested on the real HTTP parser. `(needs human input)`

### Investigation Log

#### Does any production handler emit `reason: 'revoked'`?

- Examined: repo grep `reason: 'revoked'`; `query-auth.ts`; auth route handlers.
- Found: README only. Product sync 401s are `expired`. Auth REST uses `{ error: 'unauthorized' }` without `reason`.
- Conclusion: resolved for current tree. Wipe is client-side classification of a body the product API does not send. Property still requires the default to stay expired.

#### What does a malformed 401 become?

- Examined: `sync-http-client.ts` 401 branch.
- Found: `json().catch(() => ({}))` then only exact string matches for `upgrade_required` and `revoked`; else `expired`.
- Not found: a test of empty/HTML 401.
- Conclusion: resolved — default is expired. No test pin on the HTTP parse path.

#### Should a future product revoke use sync 401 `reason: 'revoked'`, or a dedicated channel?

- Examined (this pass): repo grep `reason: 'revoked'`; `apps/server/src/sync/query-auth.ts`; `pkgs/auth` 401 bodies; README / CONTRACTS wipe comments; sim `withSimAuthRetry`.
- Found: still README/sim only. Product sync 401s are `expired`. Auth REST is `{ error: 'unauthorized' }` with no `reason`. Client parser already forks `revoked` vs default `expired`. No design note choosing a future revoke channel.
- Not found: a product “sign out all devices” / stolen-session emit path or a dedicated wipe RPC.
- Conclusion: tagged `(needs human input)` — code cannot say whether a future revoke should reuse this 401 reason. Property tests the parser either way; well-formed `revoked` must be injected by the workload until a product emitter exists.
