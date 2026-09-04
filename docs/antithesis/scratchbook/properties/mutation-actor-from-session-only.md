# mutation-actor-from-session-only

Focus: Security Boundaries.
Existing Antithesis SDK: **missing**. Suggested assertions are new.

## Why this property

Sync writes are authorized as `MutationEnv.actorId` / `accountId` / `deviceId` / `isAnon`. The server claims these come **only from session auth** (Bearer + `x-anon-id`), never from the mutation JSON body. If a client can smuggle `actorId` / `accountId` in args or a batch envelope, every domain mutation that writes `env.actorId` (profile, spaces host, friends, chess `ownerId`) becomes a privilege-escalation gadget.

This is the HTTP counterpart of room-gateway identity: two write planes, same claim ("identity is resolved, not claimed").

## Code paths

| File | What it does |
|---|---|
| `apps/server/src/sync/query-auth.ts` `resolveSessionReplayAuth` | Comment: "Never trust client body for identity." Builds `{ actorId: auth.myId, deviceId, accountId, isAnon }` from `sessionAuth.resolveAuthContext`. Catch → `{ error: 'auth', reason: 'expired' }` (fail closed — unlike the room gateway). |
| `pkgs/sync-engine/src/server/sync-app-mutations-route.ts` | `resolveAuth` then maps batch items to `{ id, name, args, clientId, seq, createdAt }` only. No actor fields on `MutationRow`. |
| `pkgs/sync-engine/src/mutations/server/replay-mutation.ts` `applyReplayMutationInTxn` | `MutationEnv` is copied from `deps.auth` (session). `now` pinned to `m.createdAt`. Args are schema-parsed `parsedValue` only. |
| `pkgs/sync-engine/src/mutations/client/create-mutation-client.ts` | Local apply uses engine `options.env`, not args. |
| `libs/chess/src/use-cases/append-puzzle-interaction/shared/append-puzzle-interaction-mutation.ts` | Args include `ownerId`; run throws `CHESS_WRITE_DENIED` unless `args.ownerId === env.actorId`. Same pattern in `upsert-puzzle-profile-mutation.ts`. |
| `libs/spaces/src/shared/space/space-mutation-helpers.ts` `accountId` | Anon / missing `accountId` → `SPACE_NOT_SIGNED_IN`. Runtime checks use `env`, not args. |
| `libs/auth/src/root/server/auth-routes.ts` `POST /identity/refresh` | Account id from `BearerAuthResolver.resolveAccountId`, not body. Body is device metadata allowlist only. |
| `libs/auth/src/root/server/auth-routes.ts` `POST /identity/anon/ensure` | **Does** accept optional `userId` in JSON (UUID). Passed to `EnsureAnonUserUseCase` → `AnonUserService.ensureForDevice`. This is the one identity-shaped body field on the auth HTTP surface. |

`upsertExternalAccount` (called from `AuthSnapshotRefresher.refresh` with `userId: accountId` from the **resolved session**, not the client) is a sibling invariant: a conflict on `(provider, external_id)` must not move `user_id` to the caller. Unit pin: `libs/auth/src/root/server/external-account-repository.test.ts` (`upsertExternalAccount never reassigns user_id on conflict`). Implementation file `libs/auth/src/public/external-account-repository.ts` was not readable in this pass (permission denied); treat the test + call site as the claim.

## Failure scenario

1. Attacker uploads `joinSpace` / `claimUsername` / `appendPuzzleInteraction` with args `{ ownerId: victim, ... }` or a forged batch field `actorId`.
2. If replay ever copied identity from args/body, victim-owned rows and host actions apply as the victim.
3. Concurrent account-switch + in-flight upload: session A vs body leftover from B (same device file) — `account-switch-pool-isolation.sim.test.ts` is the sim pin; Antithesis adds real HTTP + kill mid-refresh.

Anon ensure `userId` in body is a **separate** mint path (out of this property). `ensureForDevice` ignores a proposed id when the device is already bound to a live anon user, and will not adopt a signed-in (`is_anon` false) row. An unbound device **can** adopt another anon id — that is a sibling takeover property, not mutation-env smuggling.

## Invariant (checkable)

For every accepted `POST /api/mutations` replay and every `POST /api/query` authorize/run:

- `MutationEnv` / `RunQueryAuth` `actorId`, `accountId`, `deviceId`, `isAnon` equal the session resolver output for that request.
- Mutation args may contain `ownerId` / `userId` (invitee, friend target, chess owner) but those values never become `env.actorId`. Writes that set owner columns must use `env.actorId` or require `args.ownerId === env.actorId`.
- `POST /identity/refresh` `accountId` equals bearer resolve, never a body field.

`Always` — this is a per-request safety invariant, not a liveness condition.

## Suggested SUT instrumentation (all missing)

- `Always` at the start of `applyReplayMutationInTxn`: `env.actorId === deps.auth.actorId` (and same for device/account/isAnon). Cheap, unique message per field.
- `Always` in `resolveSessionReplayAuth` after success: `actorId === auth.myId`.
- `Unreachable` for "mutation applied with env.actorId taken from parsed args".
- Chess: `Always` that applied `appendPuzzleInteraction` has `ownerId === env.actorId`.

## Open questions

None. SDK missing (`existing-assertions.md`). Anon-ensure body `userId` is a separate mint path (see log), not this mutation-env invariant.

## Assumptions

- Protocol v3 batch has no identity envelope fields (confirmed in `MutationRow` / route mapper).
- Client local apply using `options.env` is the same env the upload will replay with after session resolve — mismatch after account switch is the isolation property, still "session wins."

### Investigation Log

#### What does `AnonUserService.ensureForDevice` do when `userId` is supplied?

- Examined: `libs/auth/src/public/anon-user-service.ts` `ensureForDevice` / `resolveMintUserId`; `anon-user-service.test.ts`; `POST /identity/anon/ensure` in `auth-routes.ts`.
- Found: if the device is already bound to a live anon user and `forceNew` is false, the proposed `userId` is **ignored**. Otherwise `resolveMintUserId` uses the proposed UUID unless that row exists and `is_anon` is false — then it mints a new id. `insertAnonUser` is `ON CONFLICT DO NOTHING` then `bindDeviceToUser`. Unbound device **adopts** a client-proposed id (create-if-missing). Already-bound ignores a different proposed id. Signed-in (`is_anon` false) proposed id is not adopted.
- Not found: a path that rebinds the caller’s `x-anon-id` to an existing **signed-in** `users.id`. Adopting another **anon** row when unbound is possible (separate takeover property, not this one).
- Conclusion: resolved — out of scope for mutation-env. This property stays “session wins on `/query` and `/mutations`.”

#### Are there `defineMutation` args schemas that include `actorId` / `accountId` / `isAnon`?

- Examined: `args: z.object` under `libs/**/use-cases/**/shared/*mutation*.ts` and `ensure-device-mutation.ts`.
- Found: no `actorId` / `accountId` / `isAnon` fields. Chess has `ownerId` (must equal `env.actorId`). Friends/spaces have target `userId` / `toUserId`. `ensureDevice` args are a device snapshot; the row id is `env.deviceId`.
- Not found: a mutation args schema that can populate `MutationEnv`.
- Conclusion: resolved — invariant stays args-may-contain-owner-targets, never `env.actorId`.
