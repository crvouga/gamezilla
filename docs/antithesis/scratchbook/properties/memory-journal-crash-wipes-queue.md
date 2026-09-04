# memory-journal-crash-wipes-queue

Focus: Failure Recovery. Confidence: high.

## Claim to test (not a fact)

A process kill under `PRAGMA journal_mode = MEMORY` must not leave a **successful** open serving a torn mix of committed and in-flight pages.

Two recovery surfaces (do not conflate):

1. **Expo wipe-on-corrupt** (`impl-expo-sqlite` / web owner recovery): a failed open (native: any first failure; web: wipe-worthy matcher) deletes the identity file, including `sync_engine_mutations`. After that wipe the client reopens empty, hydrates **server-authoritative** rows, ids that existed only in the deleted queue must not appear on the server, and the UI must not keep presenting pre-crash optimistic state as durable.
2. **First Antithesis topology** (`impl-bun-sqlite` / `impl-better-sqlite3`): the same MEMORY pragma runs on `connect()`, but open/connect failure **asserts** — there is no delete-and-retry. A successful open must still be last-commit (or the process must fail closed). Empty-queue-after-wipe is **not** this image unless setup adds Expo recovery.

This is a different recovery procedure from `SCHEMA_EPOCH` cache wipe, which **claims** to preserve `sync_engine_mutations`. File delete does not.

## Why this property

Every new SQLite connection runs `PRAGMA journal_mode = MEMORY` (`connection-pragmas.ts`). A process kill mid-txn can tear the DB without a rollback journal. First open failure on expo-sqlite calls `deleteDatabaseAsync` and retries. Web owner-runtime wipe-worthy errors call `recoverSqlOwnerInProcess` → `resetStore` / OPFS directory wipe.

SUT analysis A11 and failure mode: “crash mid-txn can corrupt; recovery deletes the DB file (pending queue gone).” Epoch-bump pin `epoch-bump-wipes-cache-preserves-pending-uploads` is the *other* recovery path — do not confuse them.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Failure scenario

1. Offline (or mid-upload) `mutate()` commits locally: domain row + queue row in one SQLite txn.
2. Process kill / tab crash while a later txn is open (MEMORY journal has no durable rollback image).
3. Next open fails (corrupt / cannot create journal sidecar / pool exhaustion classified as wipe-worthy).
4. Recovery deletes the file (or OPFS directory) and opens a fresh empty DB.
5. Engine migrates from scratch, `paintReady` on identity match, hydrates via `POST /query`.

If recovery assumes a still-present queue (the epoch-bump mental model), the client waits forever for an upload that will never happen. If optimistic UI cache outlives the file (room Kv, in-memory React state, a second tab’s handle), the user sees local-only writes that the server never got and never will.

False-positive wipe of a *healthy* file with a live queue is the worst case: silent loss of acknowledged-to-the-user work.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sql-client/src/sqlite/connection-pragmas.ts` `applySqliteConnectionPragmas` | `PRAGMA journal_mode = MEMORY` and `temp_store = MEMORY` on every Bun/Expo connection. Comment: web OPFS must not create `-journal` / WAL sidecars. |
| `pkgs/sql-client/src/sqlite/impl-sqlite-mem.ts` | Same MEMORY pragma in the mem engine. |
| `pkgs/sql-client/src/sqlite/impl-expo-sqlite.ts` `openAfterFirstFailure` / `deleteDbFile` | First open failure → `SQLite.deleteDatabaseAsync` → retry once. All platforms. |
| `pkgs/sql-client/src/sqlite/web/recover-in-process.ts` `recoverSqlOwnerInProcess` / `openSqlOwnerWithRecovery` | Wipe-worthy error → peer drop → force-release SharedWorker → `resetStore` or OPFS wipe. Returns a fresh empty cache. |
| `pkgs/sql-client/src/sqlite/expo-web-recovery-core.ts` | Message matcher includes `database corruption` and `automatic recovery is blocked`. |
| `pkgs/sql-client/src/sqlite/web/sql-owner.ts` `isSqlOwnerWipeWorthyError` | Classifies lock exhaustion / corrupt / migrate failure as wipe-worthy. |
| `pkgs/sync-engine/src/shared/framework-server-ddl.ts` `FRAMEWORK_DURABLE_TABLE_NAMES` | Only `sync_engine_mutations` survives **CACHE** / epoch wipe — irrelevant once the *file* is deleted. |
| `pkgs/sync-engine/src/client/local-schema-migrate.ts` | Epoch bump wipes cache tables, keeps durable queue. Opposite of file delete. |
| `pkgs/sync-engine/src/tests/scenarios/epoch-bump-wipes-cache-preserves-pending-uploads.sim.test.ts` | Pins the epoch path, not MEMORY-journal crash. |
| `pkgs/sql-client/src/sqlite/web/cache-recovery.matrix.test.ts` | `corrupt store auto-wipes and opens` — empty cache after wipe. |

Sim crash with `preserveLocalDb: true` **skips** this path. Antithesis process kill + real SQLite file is the unique value.

## What goes wrong if violated

Pending spaces/friends/puzzle writes the user already saw locally vanish with no write-rejection inbox. Or the client re-mints new mutation ids for the same UI action and double-creates on the server. Or a second tab still holding the old image uploads after the owner tab wiped — split-brain local files.

## SUT instrumentation (all missing)

Recovery **subphases** (not a single “entered recovery” marker):

- `Reachable` — first open failed, about to `deleteDatabaseAsync` (`sqlite.open.delete_and_retry`).
- `Reachable` — `recoverSqlOwnerInProcess` completed and reopen succeeded (`sqlite.wipe.reopen_empty`).
- `Reachable` — wipe-worthy classify fired (`sqlite.wipe.classified`).
- `Reachable` — second open after wipe still failed (`sqlite.wipe.reopen_failed`).
- `Unreachable` — wipe of a file that opened cleanly (false-positive delete).

Safety / liveness:

- `Always` — after a wipe-and-reopen, `sync_engine_mutations` pending count is 0 until new user actions.
- `Always` — mutation ids that existed only in the pre-wipe queue never appear in `sync_engine_mutations_applied`.
- `Always` — server-applied domain rows for that user still hydrate after wipe (snapshot path).
- `Sometimes(cond)` — wipe-on-corrupt ran **and** the user had a non-empty pending queue at crash time (`sqlite.wipe.lost_pending_queue`). Search hint for the expensive case.

## Open questions

- Does native expo-sqlite’s iOS VFS actually switch to MEMORY (vs silently staying delete/WAL)? `(partial: pragma issued on every Expo connect; no in-tree WAL override; runtime honor not empirically verified)`
- After owner wipe, can a follower that missed `prepare-wipe` later become owner and POST ids that existed only in the deleted file? `(partial: followers do not start uploadQueue; prepare-wipe disconnects SQL; handoff+stale-handle not proven; first topology has no tabs)`

## Related

- `crash-after-apply-before-ack` — requires the queue to survive; this property is what happens when it does not.
- Epoch-bump cache wipe is **not** this property.

## Synthesis merge (orchestrator)

Also covers: `sqlite-memory-journal-wipe-on-corrupt`.

Safety split: a successful post-crash open is last-commit or (Expo only) a freshly wiped empty DB — never a torn file served as live state. If Expo wipe ran, the pending queue is gone. First topology: MEMORY journal + fail-closed on connect error; no auto-wipe unless setup adds it.

### Investigation Log

#### Does native expo-sqlite (iOS) honor `journal_mode=MEMORY`, or does the native VFS ignore it?

- Examined: `connection-pragmas.ts` (unconditional `PRAGMA journal_mode = MEMORY` + `temp_store = MEMORY`); `impl-expo-sqlite.ts` `connect()` → `applySqliteConnectionPragmas`; `impl-bun-sqlite.ts` / `impl-better-sqlite3.ts` / `impl-sqlite-wasm.ts` / web `owner-runtime.ts` same helper; ripgrep for `WAL` / `journal_mode` under `pkgs/sql-client`.
- Found: every product SQLite engine issues MEMORY on connect. Comment motivation is web OPFS sidecars, but the pragma is not web-gated. No later `journal_mode=WAL` / DELETE override in-tree.
- Not found: an iOS/Android runtime probe that reads `PRAGMA journal_mode` after connect; expo-sqlite native source that would ignore the pragma.
- Conclusion: tagged `(partial: pragma issued on every Expo connect; no in-tree WAL override; runtime honor not empirically verified)`. If native ignored MEMORY, the kill-mid-txn tear window shrinks and Expo wipe-on-kill is mostly web/OPFS.

#### Which open errors are wipe-worthy vs retried without delete?

- Examined: `impl-expo-sqlite.ts` `openWithRecovery` / `openAfterFirstFailure`; `sql-owner.ts` `isSqlOwnerWipeWorthyError`; `expo-web-recovery-core.ts` message matcher; `impl-bun-sqlite.ts` / `impl-better-sqlite3.ts` `connect()`.
- Found: native Expo deletes on **any** first `openDatabaseAsync` failure (no matcher) then retries once. Web owner wipe requires the matcher (`cannot create file`, `sqlite3_open_v2`, timeout, not-a-database / malformed, `schema epoch`, `migrateLocalSchema failed`, `ensureDomainTables/migrate`). Web message matcher also includes corruption / `SQLITE_IOERR` / OPFS handle held. Bun/better-sqlite3: `SELECT 1` + pragmas, then `assert.ok(false)` — no delete.
- Not found: a retry-without-delete path on native Expo first open; wipe-on-corrupt in the first topology’s Node engines.
- Conclusion: resolved — native matcher is “any open error”; web is classified; Node topology fail-closes. Too-wide native delete of a healthy file is an Antithesis case (`Unreachable` false-positive wipe), not an open definition.

#### After wipe, does account-scoped file naming reopen the same path?

- Examined: `resolve-sqlite-db-name.ts` (`user_${12 hex}`); `open-main-sql-client.ts`; `impl-expo-sqlite.ts` `deleteDbFile` then `openDatabaseOnce` with the same `databaseName` / directory; `wall-client-env.ts` `resolveDatabaseName`.
- Found: name is a pure function of `users.id`. Wipe deletes that name and retries that name. No remapping to `user_pending` or another account’s file.
- Not found: a recovery path that opens a different `databaseName` after delete.
- Conclusion: resolved — same path; cannot “revive” another identity’s queue by renaming.

#### Can a follower tab (no `sync-owner` lock) still hold a pre-wipe image and upload after the owner wiped?

- Examined: `sync-owner-lock.ts`; `create-local-sync-engine.ts` `enableMutationUpload: syncLease.isOwner`; `create-local-sync-engine.ts` (engine) skip `uploadQueue.start()` when false; `recover-in-process.ts` BroadcastChannel `prepare-wipe`; `impl-expo-web-client.ts` `onPrepareWipeMessage` → `client.disconnect()`.
- Found: followers never start the upload loop. Owner wipe asks peers to drop SQL handles (same `gamezilla-opfs-wipe` channel). First topology is Node — no Web Locks / extra tabs.
- Not found: a follower that re-acquires `sync-owner` without remounting; a test that a missed `prepare-wipe` plus later handoff POSTs pre-wipe mutation ids.
- Conclusion: tagged `(partial: followers do not start uploadQueue; prepare-wipe disconnects SQL; handoff+stale-handle not proven; first topology has no tabs)`. Isolation of “ids only in the deleted file never reach the server” is still the invariant; multi-tab is a later Chromium variant.

#### Does the first topology’s SQLite engine honor MEMORY journal and the Expo wipe-on-corrupt path?

- Examined: `deployment-topology.md` client image (bun/better-sqlite3); `impl-bun-sqlite.ts` / `impl-better-sqlite3.ts` `connect()`; Expo `openAfterFirstFailure`.
- Found: Node engines call `applySqliteConnectionPragmas` (MEMORY). They do **not** delete-and-retry on open failure. Topology already notes Expo wipe may not apply.
- Not found: a planned Node wrapper that copies Expo `deleteDatabaseAsync` recovery.
- Conclusion: resolved — MEMORY yes; Expo wipe **no**. Property prose split: first campaign is last-commit or fail-closed; wipe-empties-queue is Expo (or a setup add-on).
