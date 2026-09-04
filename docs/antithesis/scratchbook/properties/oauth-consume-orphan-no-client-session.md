# oauth-consume-orphan-no-client-session

Focus: Lifecycle Transitions. Complement of `oauth-exchange-code-consumed-once` (that card is “at most one session per code”; this card is consume-success + client-without-session).

## Claim to test (not a fact)

If Google’s (or Dev’s) one-time code is consumed, or the exchange code is consumed, and the client never persists a bearer — attach failed, `createSession` failed, or the HTTP 200 after consume was lost — then: (1) the IdP user row exists; (2) the client is not signed in (empty bearer store); (3) a **new** OAuth launch for the same provider subject eventually yields a session for that same `idp_users.id`. The consumed code must not be replayable (`invalid_code`) — that half is already `oauth-exchange-code-consumed-once`.

SUT `[failure]`: “Google code consumed, attach failed — user exists, client has no session.” Existing OAuth evidence: lost-ack after consume is consume-once *working*; recovery is restart OAuth, not replay.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Why this property

`upsertSocialUser` inserts or updates `idp_users` / `idp_accounts` **before** `attachExchangeCode`. Google token exchange is consumed at Google (or `consumeProviderAuthCode` DELETE for Dev) before the 302 with `?code=` is returned. `handleSessionExchange` DELETEs the exchange-code row, then `findUserById`, then `createSession` (new token, no unique on user). The client `exchangeCode` does **one** POST and does not retry the same code (`create-auth-client-adapter.ts`). `persistSessionFromResponse` writes the bearer only after `res.ok`.

So three orphan shapes, all first-topology:

1. **Attach / 302 lost after user upsert.** Google/Dev code gone; `idp_users` exists; no `exchange_code_hash`; client never POSTs `/auth/session`.
2. **Consume then `createSession` / `findUserById` fails.** Exchange row deleted; user exists; no `idp_sessions` row.
3. **Consume + session insert, HTTP 200 lost.** User and session exist; client store empty. Replay of that code is `invalid_code`. Restart OAuth upserts the same `provider` + `provider_user_id` and mints a **second** session (`createSession` always INSERTs).

Consume-once forbids the second POST of the *same* code from minting. This property forbids treating the client as signed-in, and requires restart-OAuth to bind a bearer to the existing user.

## Code paths

| Path | Role |
|---|---|
| `pkgs/auth/src/server/idp-repository.ts` `upsertSocialUser` | User exists after Google/Dev callback, before attach. |
| same file `attachExchangeCode` / `consumeExchangeCode` / `consumeProviderAuthCode` | SELECT then DELETE; attach is an UPDATE of `idp_oauth_states`. |
| `pkgs/auth/src/server/auth-route-handlers.ts` `handleOauthCallback` / `finishOauthCallback` | Provider consume → upsert → attach → 302 `?code=`. |
| same file `handleSessionExchange` | consume → findUser → createSession → 200 + `set-auth-token`. |
| `pkgs/auth/src/client/create-auth-client-adapter.ts` `exchangeCode` / `persistSessionFromResponse` / `signInOauth` | One POST; no retry; write bearer only on 200. |
| `apps/server/src/auth/auth-routes.ts` `/identity/e2e/sign-in` | Dev remint (same `upsertSocialUser` + `createSession`). |

## Failure scenario

1. Workload starts oauth-dev (or fake Google) on alice. Callback runs `upsertSocialUser` for subject S.
2. Antithesis: kill/partition api after upsert and before attach; or after consume and before the client reads 200; or drop the 302.
3. Observe: `idp_users` / `idp_accounts` for `(dev|google, S)` exist; alice’s bearer store is empty; `GET /auth/session` without a token is 401. Same-code `POST /auth/session` is `invalid_code` if consume already ran.
4. Restart OAuth (new launch, new state, same subject). **Bug if** the client is treated as signed-in with no bearer. **Bug if** the second ceremony creates a *different* `idp_users.id` for S (`upsertSocialUser` should reuse `findAccountUserId`). **Bug if** the client never gets a persistable token after a successful 200.

First topology: fake Google / oauth-dev; one of alice/bob; no OPFS. Postgres (or e2e/session JSON) must be readable for the user-id oracle — same setup need as `oauth-exchange-code-consumed-once`.

## What goes wrong if violated

Confirmed Google/Dev success, then the app is anonymous. A second ceremony that mints a **new** user leaves two `idp_users` for one Google account (profiles, spaces, SQLite file name diverge). A client that paints “signed in” from the 302 alone has no API token and cannot drain mutations. Consume-once can pass while this hole is the whole user-visible failure.

## SUT instrumentation (all missing)

- `Always` after consume-or-upsert without a persisted bearer: client bearer length 0; `GET /auth/session` with that store is 401.
- `Always` after a later successful ceremony for the same provider subject: session `user_id` equals the pre-existing `idp_users.id` (or e2e `userId`).
- `Sometimes(oauth.orphan_user_no_client_session)` — user/account row exists and the completing client has no token.
- `Sometimes(oauth.lost_session_200_after_consume)` — `idp_sessions` row exists, client store empty, replay `invalid_code`.
- `Reachable` — `attachExchangeCode` threw/failed after `upsertSocialUser`.
- `Unreachable` — client `online` / session UI true with an empty bearer after a failed attach or lost 200.

## Open questions

- Should a lost 200 after `createSession` leave the unused `idp_sessions` row live, or should restart-OAuth invalidate it? `(needs human input)`

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Should a lost 200 after `createSession` leave the unused `idp_sessions` row live, or should restart-OAuth invalidate it?

- Examined: `idp-repository.ts` `createSession` / `deleteSessionByToken` / `upsertSocialUser`; `handleSessionExchange`; `handleSignOut`; `idp_sessions` schema (unique `token_hash` only).
- Found: `createSession` always INSERTs. Restart-OAuth reuses `idp_users.id` via `findAccountUserId` and mints a **second** session. Sign-out DELETEs only by the bearer the client holds — after a lost 200 the client has no token, so it cannot delete the unused row. No “invalidate other sessions for this user” path on a new ceremony.
- Not found: a unique on `user_id`, a revoke-siblings UPDATE, or a comment that unused sessions must be collected.
- Conclusion: tagged `(needs human input)` — code leaves the unused row live and restart-OAuth does not invalidate it. Property Always is “same `idp_users.id` + client not signed-in,” not “at most one live session.” If the owner wants single-session, that is a different invariant.

#### Does fake-Google in the api image re-issue a provider code on a second launch, or is oauth-dev the only restartable path?

- Examined: `pkgs/auth/src/testing/fake-google.ts`; `auth-route-handlers.ts` Google vs Dev callback; `pkgs/auth/src/tests/system/dispatch.ts` `googleApprove` / `devApprove`; topology “Auth: oauth-dev / fake Google.”
- Found: fake Google’s token endpoint always 200s; it does **not** consume codes. `googleApprove` mints a **new** `createId()` code, maps it to the same subject in `googleSubjects`, and hits `/auth/callback/google`. Dev `handleDevAuthorizeComplete` also mints a new `authCode` per complete. Both second launches are restartable if the harness binds the new provider code to the same subject.
- Not found: a one-shot fake-Google registry that refuses a second launch for the same subject.
- Conclusion: resolved — fake-Google **and** oauth-dev are restartable. oauth-dev is not the only path. Workload must mint a new provider code mapped to subject S (same as the auth-world harness).
