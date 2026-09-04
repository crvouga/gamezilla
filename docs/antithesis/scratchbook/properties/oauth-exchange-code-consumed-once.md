# oauth-exchange-code-consumed-once

Focus: Idempotency and Replay.

## Property (catalog draft)

An OAuth session exchange code is consumed at most once. A second `POST /auth/session` with the same `code` must not mint another `idp_sessions` row (retry after success → `invalid_code`). Concurrent exchanges of one code mint at most one session.

## What led here

SUT analysis failure mode: “`consumeExchangeCode` is SELECT then DELETE — two concurrent exchanges can both create sessions.” Auth is otherwise quiet (young DST, no bugs-found). This is the only one-time secret on the IdP path that is not a hashed bearer.

The client receives the code from the IdP callback URL and trades it for a session token. Lost HTTP on `/auth/session` plus a retry, or two tabs finishing the same redirect, are realistic at-least-once deliveries of that code.

## Code paths

- `pkgs/auth/src/server/idp-repository.ts` `consumeExchangeCode`
  - Hash the code (`hashAuthSecret`).
  - `SELECT id, user_id, expires_at FROM idp_oauth_states WHERE exchange_code_hash = $h AND deleted_at IS NULL LIMIT 1`.
  - Null / missing `user_id` / expired → `null`.
  - Then `DELETE FROM idp_oauth_states WHERE id = $id` (hard delete, not a compare-and-swap).
  - Returns `user_id` **after** a successful read, even if the DELETE affected 0 rows.
- `pkgs/auth/src/server/auth-route-handlers.ts` `handleSessionExchange`
  - `consumeExchangeCode` then `findUserById` then `createSession` (new `createId()` token, insert `idp_sessions`).
  - No repository-level transaction wrapping consume + session insert. Auth package has no `db.transaction` on this path.
- `pkgs/auth/src/server/idp-repository.ts` `attachExchangeCode`
  - Writes `exchange_code_hash`, bumps `state` to `${stateId}:used:${createId()}`.
- `pkgs/auth/src/shared/schema/tables.ts` `idpOauthStates`
  - `uniqueIndexes: ['state', 'exchange_code_hash']` — uniqueness of the hash, not atomic consume.

`createSession` always inserts a new row (sessions are not unique per user). Two successful consumes ⇒ two live tokens for the same `user_id`.

## Existing pins

None found that race two `/auth/session` calls or retry the same code after 200. Client adapter tests use a canned `code=exchange-code` redirect URL only.

## Failure if violated

One Google / Dev OAuth redirect yields two valid API sessions. A stolen or retried code after the legitimate client already succeeded still signs in. Account-switch / file-switch flows that assume one session per upgrade can attach the second token to a different device.

Lost-ack **after** a successful consume is a different shape: the row is gone, retry returns `invalid_code`, and the client has no token. That is consume-once working; recovery is “restart OAuth,” not “replay the code.”

## Antithesis angle

- Two concurrent `POST /auth/session` with the same body (two isolates, READ COMMITTED, no row lock / `DELETE … RETURNING`).
- Delay between SELECT and DELETE (thread pause) so both reads succeed.
- Sequential retry after 200: second must be 400 `invalid_code` and `idp_sessions` count for that consume stays 1.

## Instrumentation

No Antithesis SDK (`existing-assertions.md`). Missing:

- `Always`: `COUNT(*)` of `idp_sessions` created from a given `exchange_code_hash` ≤ 1 (workload can track code → session ids).
- `Always`: after one 200, a replay of the same code is 400 and inserts zero sessions.
- `Reachable`: `consumeExchangeCode` returned `null` because the row was already gone (the intended retry path).
- `Unreachable`: two sessions whose creation is attributable to one code.

SUT-side is more useful than HTTP-only: the SELECT/DELETE gap is invisible if the workload only checks the first response.

## Open questions

None. SDK missing (`existing-assertions.md`).

### Investigation Log

#### Is consume a single atomic `DELETE … RETURNING`?

- Examined: `idp-repository.ts` `consumeExchangeCode`; `handleSessionExchange`; `idpOauthStates` unique indexes; grep for `db.transaction` under `pkgs/auth`.
- Found: SELECT then unconditional DELETE by id. Unique on `exchange_code_hash` does not serialize two readers. `createSession` is a separate INSERT. No auth-package transaction around the pair.
- Not found: `FOR UPDATE`, `DELETE … WHERE hash = $h RETURNING`, or a `consumed_at` CAS.
- Conclusion: the double-consume window is in the source. Property tests the claimed one-time code, not a guarantee the implementation already enforces.

#### Can the same code be recovered after a lost session response?

- Examined: `consumeExchangeCode` DELETE; `handleSessionExchange` 400 `invalid_code`; `createSession`.
- Found: successful consume deletes the state row. Replay cannot mint a replacement token.
- Not found: a second lookup table or unused-code retry path.
- Conclusion: tagged partial — consume-once holds for retries; UX recovery is restart-OAuth. Does not change the safety invariant.

#### Should a lost HTTP 200 after consume force a full OAuth restart, or is there another recovery?

- Examined: `pkgs/auth/src/client/create-auth-client-adapter.ts` `exchangeCode` / `persistSessionFromResponse` / `completeHostedAuthRedirect` / `getFreshToken`; `handleSessionExchange`; `consumeExchangeCode`; anon ensure path.
- Found: one POST of `{ code }`. No retry of the same code. `getFreshToken` only reads the bearer store. Anon ensure is a different mint (`x-anon-id` / optional body `userId`), not a replay of the exchange code. After a successful consume the state row is gone; replay is `invalid_code`.
- Not found: a second lookup table, unused-code retry, or refresh that recreates the session from the consumed code.
- Conclusion: resolved — lost-ack after 200 cannot recreate the session. Recovery is restart OAuth. Safety invariant unchanged.

#### Any unique constraint linking session to exchange code?

- Examined: `pkgs/auth/src/shared/schema/tables.ts` `idpSessions` / `idpOauthStates`; `createSession` INSERT.
- Found: `idp_sessions` unique is `token_hash` only. No `exchange_code` column, no FK from session to oauth state. `idp_oauth_states` unique is `state` + `exchange_code_hash`.
- Not found: a unique that would make a second session insert fail for the same code.
- Conclusion: resolved — the Always must count sessions in the workload (code → session ids). The schema does not enforce one session per code.

#### Same Always on `consumeProviderAuthCode`?

- Examined: `consumeProviderAuthCode`; `idp_provider_auth_codes` unique `code_hash`; Dev callback in `handleOauthCallback`.
- Found: same SELECT-then-DELETE-by-id. Unique on hash does not serialize two readers. Used for Dev IdP chooser → callback, not `/auth/session`.
- Not found: `DELETE … RETURNING` or a transaction around consume + `upsertSocialUser`.
- Conclusion: resolved — same Always (at most one consume / at most one derived session or user bind per provider code). Already in this property’s catalog sentence.

## Synthesis merge (orchestrator)

Also covers: `oauth-exchange-code-single-consume`. Same SELECT-then-DELETE consume; include `consumeProviderAuthCode` as the sibling one-time secret.
