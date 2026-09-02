# account-switch-close-then-open-sqlite

Focus: Lifecycle Transitions (identity / file lifecycle). Account switch and returning-Google sign-in must close the prior SQLite (web OPFS single-session) before opening `user_<12 hex of users.id>`. Pending rows stay in the old file and must not appear in the new one.

## Why this property

Local DB name is `user_${users.id with dashes stripped, first 12 hex}`. Anon install and signed-in user use the same scheme. First-time Google **upgrade** keeps the same `users.id` (anon row flipped `is_anon=0`) so the file name is unchanged. **Returning** Google (`EnsureInternalAccountUseCase` when the external id already maps to another user) returns that existing `users.id`, which is a **different file**. `AuthSyncBridge` remounts `SyncEngineBoot`; the pool must `disconnect` + `db.disconnect` the prior handle before the next `open`. Web OPFS is single-session: leaving the old handle open makes the next open fail, and wipe recovery throws “another tab or worker is holding the OPFS handle.”

`paintReady` stays false until the new engine is `ready`, so UI must not read the old file as the new account.

## Code paths

- `apps/client/src/storage/resolve-sqlite-db-name.ts` — `user_${shortId}`; `shortId` = 12 hex. Not memoized across identity.
- `apps/client/src/storage/open-main-sql-client.ts` — `userId === null` → `user_pending` (boot blank path should not open this for product reads). Web: `createExpoWebSqlClient` + connect; native: expo-sqlite.
- `pkgs/sync-engine/src/client/sync-engine-pool.ts`
  - `opChain` serializes `getOrCreate` so two identity opens never overlap.
  - `deactivatePrevious`: if `activeName !== nextName`, soft-stop (`engine.disconnect`) **then** `db.disconnect`, delete from `ready`. Comments name OPFS single-session and wipe-recovery.
  - Concurrent `getOrCreate` for different names: second waits on `opChain`; first identity is closed; only the last name stays in `ready`.
  - `releaseAll` bumps `releaseGeneration` so an in-flight create cannot resurrect a closed DB.
- `apps/client/src/providers/local-database/sync-engine-boot.tsx`
  - `useCurrentAccountId()`; null → blank screen (no engine).
  - `dbName` from `env.resolveDatabaseName({ userId })`.
  - Sticky prior engine is **cleared** when `dbName` or pool changes (231–238). Non-embedded may still mount the last ready engine of the **new** name only (`warmEngine`).
  - `paintReady = boot.phase === 'ready'` for the current promise — false during switch.
- Returning Google: `libs/auth/src/root/server/anon-user-service.test.ts` “switches to existing linked account instead of upgrading” — `EnsureInternalAccountUseCase.execute({ externalUserId, upgradeUserId: anon.userId })` returns `other.userId`, not the current anon id.
- Isolation pin: `pkgs/sync-engine/src/tests/scenarios/account-switch-pool-isolation.sim.test.ts` — pending on A not live on B; `peekReady('user-a')` null after switch; concurrent creates do not overlap.

## Failure scenario

1. Anon user queues mutations in `user_<anon12>`.
2. Google sign-in for an account that already exists → client `currentUserId` jumps to the returning `users.id`.
3. If the pool opens B before A’s OPFS handle is released: open throws / hangs; or both handles alias one file.
4. If the pool keeps A sticky with `paintReady === true`: UI shows anon pending (spaces the returning user never had) in the returning account.
5. If A’s pending is copied or the same connection is reused under B’s name: account-switch leak (SUT analysis: “account-switch pending A must not appear in B”).

Antithesis: pause between `disconnect` and `db.disconnect`; kill the tab during `opChain`; two rapid identity flips (Google cancel / second account); returning-user sign-in while A still has an in-flight `POST /api/mutations`.

## Key observations

- First-time Google upgrade is **not** a file switch (`accountId === anon.userId`). The dangerous transition is returning-user / explicit account switch only. Tests must use two distinct `users.id`s.
- Sim pool test uses `:memory:` and crashes nodes before reopen — it does **not** exercise real OPFS exclusivity. That is the Antithesis gap.
- `user_pending` is a named fallback when `userId` is empty. Product boot returns a blank screen instead of opening it when `useCurrentAccountId()` is null — but a transient empty id would share one global pending file across installs (SUT A4).
- 48-bit prefix collision (`shortId` = 12 hex) would merge two users onto one file. Separate property if cataloged; here assume ids do not collide.
- Anon’s queued mutations stay on the old file after a returning-Google switch. They must not upload under B’s session. Whether they are **retained** on disk for a later switch-back is unspecified; isolation is the invariant.

## Existing instrumentation

Missing. Sim isolation tests are oracles for “pending A ∉ B,” not OPFS close ordering under a real filesystem.

Suggested (all **missing**):

- `Always("pool-one-active-sqlite", ready.size <= 1)` after each `getOrCreate` settlement (product web).
- `Always("deactivate-closes-before-next-open", prior.db.disconnected before next.connect)` around `deactivatePrevious`.
- `Always("pending-ids-do-not-cross-files", !bHasRow(aPendingId))` after switch.
- `Reachable("returning-google-db-name-changed")` when `shortId(newUserId) !== shortId(oldUserId)` after OAuth.
- `Sometimes("paint-ready-false-during-db-name-change")`.

## What goes wrong if violated

Wrong-account flash (anon spaces on a returning Google user), OPFS “handle held” deadlock (app stuck on boot blank/error), or silent merge of two users’ queues into one file. Worst product failure class: “previous anon’s data after Google switch.”

## Open questions

None remaining after code investigation.

### Notes that stay in evidence (not catalog questions)

- Abandoned `user_<anon12>` is **not** deleted on returning-Google. Switch-back reopens that file (stale queue can drain under the anon session). Isolation is “A’s pending ∉ B,” not “old file gone.”
- `useCurrentAccountId()` can be null (hydration, external-user clear, token race). `SyncEngineBoot` renders the blank screen and does **not** call `getMainSqliteDbName(null)`. `user_pending` exists as a fallback in `open-main-sql-client.ts` / `userId ?? 'pending'` in wall env, but product boot with a bound user never opens it.
- `deactivatePrevious` still runs on iOS: stop upload + `db.disconnect` before the next name. Needed so the sticky engine cannot query/upload A after the React tree is B. The OPFS “handle held” error is web-only.

## Synthesis merge (orchestrator)

Also covers: `account-switch-opfs-exclusive-open`. Close-then-open is the lifecycle; OPFS exclusive handle is the web-specific failure mode of the same invariant.

### Investigation Log

#### After returning Google, is the abandoned `user_<anon12>` file ever deleted?

- Examined: ripgrep of `deleteDatabase` / `deleteDatabaseAsync` / account-switch cleanup under `apps/client` and `libs/auth`; `delete-legacy-sidecar-db.ts`; `create-local-sync-engine.ts` `deleteDatabase` (revoke / wipe of the **current** name); `sync-engine-pool.ts` `deactivatePrevious` (close, no unlink).
- Found: no sweep of unused `user_*` files on identity change. Legacy helper only deletes `${databaseName}.db` sidecars for the name being opened. Revoke/wipe deletes the active engine’s file only.
- Not found: an “abandon previous identity file” call after `EnsureInternalAccountUseCase` returns a different `users.id`.
- Conclusion: resolved — the old file remains until wipe/revoke of that name or OS data clear. Switch-back can revive the old queue. Isolation invariant unchanged.

#### Can `useCurrentAccountId()` briefly go null and open `user_pending`?

- Examined: `sync-engine-boot.tsx` (`userId === null` → `LocalDatabaseBootBlankScreen`, no pool open); `open-main-sql-client.ts` `getMainSqliteDbName(null|'')` → `user_pending`; `wall-client-env.ts` `openArgs?.userId ?? 'pending'`; `auth-bridge.tsx` `writeSecureStorageItem(LAST_LOCAL_ACCOUNT_ID_KEY, null)` on external-user change; `auth-bridge-refresh.ts` `applyRefreshSuccess` null-on-token-race; `use-secure-storage-item.ts` null until hydrated.
- Found: null gaps exist. Product boot short-circuits and never resolves a DB name while null. Returning-Google success writes the new id directly (`applyRefreshSuccess`). Empty-string is not guarded (only `=== null`), but the stored id is a UUID / minted id, not `''`.
- Not found: a `SyncEngineBoot` / `getOrCreate` path that opens `user_pending` during account switch.
- Conclusion: resolved — do not add “no product writes to `user_pending`” as a required clause of this property. Residual wall-env `'pending'` fallback is unused by the boot tree when `userId` is set.

#### Does `deactivatePrevious` still matter on iOS, or only web?

- Examined: `sync-engine-pool.ts` `deactivatePrevious` (always: `engine.disconnect` then `db.disconnect`); `sync-owner-lock.ts` native always `isOwner`; `impl-expo-sqlite.ts` native file (not OPFS single-session); `sync-engine-boot.tsx` sticky engine cleared on `dbName` change.
- Found: native can have two files open at once, but the pool still serializes and closes the prior engine so A’s upload loop / handle cannot stay live after the tree is B. OPFS “another tab holding the handle” is web-only.
- Not found: an iOS-only skip of `deactivatePrevious`.
- Conclusion: resolved — close-then-open is required on iOS for handle/upload isolation; OPFS exclusivity is web-only. Property invariant (pending A ∉ B, one active name) is platform-common.
