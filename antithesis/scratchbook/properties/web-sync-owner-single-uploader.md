# web-sync-owner-single-uploader

Focus: Distributed Coordination — **leader election for the upload/MQTT
role** among web tabs sharing one identity SQLite file. Not Raft. The lock
is a browser Web Lock named `sync-owner:${dbName}`.

## Why this property

Web has three independent ownership schemes (`sut-analysis` concurrency):

1. SQL SharedWorker / Web Lock (`pkgs/sql-client/src/sqlite/web/db-host-leader.ts`
   `createLeaderTransport`) — who owns the OPFS writer.
2. `sync-owner:` lock — who uploads mutations and attaches MQTT.
3. Per-tab room `clientId` — every tab can be a live room peer.

A tab can own SQL, **not** own sync, and still speak room WS. Followers do
not upload (`enableMutationUpload: false`) and do not get `pushOptions`
(no MQTT). If the owner tab is **hung** not dead, Web Locks do not
release (`sut-analysis` A12) and the durable queue stalls.

Native (`Platform.OS !== 'web'`) always owns. Injected sim
`openSqlClient` also skips the lock so a leftover lease cannot pin
playground reload as a permanent follower
(`create-local-sync-engine.ts` lines 190–196).

## Code paths

| Path | Role |
|---|---|
| `apps/client/src/sync/sync-owner-lock.ts` `tryAcquireSyncOwnerLease` | `navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true })`. Null lock → follower. Held until `release()` or tab death. |
| `apps/client/src/sync/create-local-sync-engine.ts` | `enableMutationUpload: syncLease.isOwner`; `pushOptions` only if owner. |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` | `enableMutationUpload === false` skips `uploadQueue.start()` (line 334). |
| `pkgs/sql-client/src/sqlite/web/db-host-leader.ts` | Separate leader election for the DB host. |
| `pkgs/sql-client/src/sqlite/expo-web-session-lock-core.ts` | Drop memo so a restored document cannot skip Web Locks after release. |

## Failure scenario

**Safety (split-brain uploaders):** two tabs both start
`uploadQueue` / MQTT for the same `dbName`. Duplicate POSTs are
idempotent by mutation id, but two MQTT sessions with the same client
id kick each other (`create-emqx-pubsub.ts` “one live connection per
id”). Two *different* MQTT client ids for one user+device double-consume
the session and can apply overlapping `handlePush`.

**Liveness (stuck followers):** owner tab paused (Antithesis thread
pause / debugger) without firing pagehide. Followers never take the
lock (`ifAvailable: true` — they do not wait). Queue stays local.
User sees confirmed local writes that never reach peers.

**Handoff after death:** owner tab killed → Web Locks release → only a
**new** `createAppLocalSyncEngine` (reload / `releaseAll` + getOrCreate)
calls `tryAcquireSyncOwnerLease` again. Live followers do not retry.
The Sometimes handoff needs a remount workload, not a paused follower.

## Partition / heal instrumentation (SUT)

All **missing**:

- `Always("web.sync_owner.at_most_one")` — count of tabs with
  `isOwner === true` for a given `sync-owner:${dbName}` is 0 or 1.
  Precondition: `navigator.locks` is present. `locks == null` (happy-dom
  / missing Web Locks) falls through to `isOwner: true` for every tab.
- `Sometimes("web.sync_owner.follower_observed")` — at least one run
  has a non-owner tab (otherwise the lock path is untested).
- `Sometimes("web.sync_owner.handoff_after_owner_death")` — owner
  process/tab killed, a former follower later uploads
  (`POST /api/mutations` from that tab).
- `Reachable("web.sync_owner.hung_owner_no_handoff")` — owner paused,
  lock still held, no second uploader. This is the **expected**
  degraded state; pair with a liveness Eventually that only applies
  after owner **death** (heal = lock release), not after pause.
- Do **not** treat SQL-host leader and sync-owner as the same lock.
  Emit both names.

Partition of the owner tab from the API (HTTP) while the lock is held
is a second fault: followers still will not upload. Heal HTTP without
killing the owner does not unblock the queue.

## Existing assertions

**Missing.** No Antithesis SDK. No product Playwright multi-tab sync
owner test (`sut-analysis` tests). Sim playground skips the lock.

## Key observations

- `ifAvailable: true` is try-lock, not a waiter queue. Handoff is
  “retry later,” but engine construction does not loop.
- Followers still subscribe to `subscribeExternalDbChanged` so UI
  watches wake when the owner writes OPFS — local visibility ≠ upload.
- Room take-over (`commandId`, close 4000) is a different leader story;
  a follower tab can still send room commands.

## Open questions

- None

### Investigation Log

#### After owner tab death, does a live follower re-run tryAcquireSyncOwnerLease?

- Examined: `sync-owner-lock.ts` (single `locks.request` with `ifAvailable: true`); `create-local-sync-engine.ts` (one acquire at construction; `release` on disconnect); `sync-engine-pool.ts` `getOrCreate` (one engine per `databaseName` until `releaseAll`); `app-sync-lifecycle.ts` (`visibilitychange` is foreground, not remount).
- Found: no follower retry loop. Comment “a follower can retry later if needed” is aspirational. Handoff requires a new engine (reload or `releaseAll` + getOrCreate).
- Not found: a visibility/pagehide path that re-acquires the sync-owner lock on a live follower.
- Conclusion: resolved — Sometimes `handoff_after_owner_death` needs a remount workload. Property **changed** (liveness after death **and** remount). SDK **missing**.

#### Does missing navigator.locks make every tab an owner?

- Examined: `tryAcquireSyncOwnerLease` (`locks == null` → `{ isOwner: true }`); happy-dom comment; catalog assumption that the first topology is Node (this property skipped until Chromium/OPFS).
- Found: the fallback is real. Always `at_most_one` is only valid when Web Locks exist.
- Not found: a product check that refuses to boot without `navigator.locks` on web.
- Conclusion: resolved — topology/workload must expose `navigator.locks` (not happy-dom). Always precondition recorded. No remaining SUT question.
