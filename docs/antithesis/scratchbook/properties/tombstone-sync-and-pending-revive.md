# Tombstones sync; later-arriving upsert may revive

Focus: Data Integrity. Slug: `tombstone-sync-and-pending-revive`.

## Evidence trail

Domain removals are claimed **soft-delete only**. Mutation wrap throws `NO_HARD_DELETE` on `DELETE FROM` domain tables. Query `run` SQL must **not** filter `deleted_at` — snapshots carry tombstones; UI/live reads filter `deleted_at IS NULL`. Merge upserts `deleted_at` verbatim.

Pending local mutations **rebase after every merge** (`rebasePending`). Product-style upserts (`setNote`) do `deleted_at = NULL` on conflict. A pending upsert that rebases onto a peer tombstone **revives** the row; that is pinned LWW-by-arrival semantics, not an accident. After converge, every replica must agree on live vs tombstone for each id — no replica may hard-absent a row the others hold as a tombstone (or vice versa after revive).

Sim pins this with in-process disconnect/reconnect. Antithesis uniquely interleaves real partition (tombstone fanout vs pending upload), process kill mid-rebase, and MQTT-then-HTTP (or reverse) so revive vs tombstone arrival order is adversarial.

`existing-assertions.md`: no Antithesis SDK. All suggested assertions are **missing**.

## Code paths

**Soft-delete enforcement**

- `pkgs/sync-engine/src/mutations/shared/wrap-mutation-db.ts` — `classify` `delete` on a non-framework table → `MutationError('NO_HARD_DELETE', ...)`.
- `pkgs/sync-engine/src/queries/server/run-query.ts` `enforceReadSql` — `hasDeletedAtPredicate` → assert fail (“tombstones must sync”); injects `deleted_at` if the select omitted it.

**Merge + rebase**

- `pkgs/sync-engine/src/client/merge-upsert.ts` — upsert intersecting columns including `deleted_at`.
- `pkgs/sync-engine/src/client/merge.ts` `rebasePending` — loads `sync_engine_mutations` ordered by `seq`, re-runs each `m.run` with `now` pinned to `created_at`. MutationError → keep queued, hide optimistic effect. Then `applyFullMerge` / `applyRowImages` both call rebase inside the same SQLite transaction as the upsert.
- Acme `setNote` (`pkgs/sync-engine/src/tests/apps/acme/shared/mutations.ts`) — `ON CONFLICT DO UPDATE SET … deleted_at = NULL`. `deleteNote` sets `deleted_at` only when live and actor owns the row.

**Pins (oracles)**

- `soft-delete-tombstone-propagates-and-revives.sim.test.ts` — delete tombstones on peer; later `setNote` revives everywhere.
- `rebase-onto-peer-tombstone-pinned-semantics.sim.test.ts` — Alice offline `setNote` while Bob tombstones; after reconnect, Alice’s pending upsert wins and all replicas are live with `alice-pending`.
- `mixed-schema-tombstone-and-pending-rebase.sim.test.ts` — `setNoteColor` revive keeps color.
- `tombstone-revive.pbt.test.ts` — PBT “revive after delete restores live row on all clients.”
- `rebase-throw-hidden-until-upload-reject.sim.test.ts` — rebase throw → optimistic hidden, tombstone wins locally until upload reject.

**SUT analysis claim A7** (lead, not used as a defect): unclassifiable DELETE `parse_error` can fall through wrap; OOB SQL is not wrapped. Not treated as a confirmed hole without a repro in this pass.

## Failure scenario

1. Replica A goes offline and queues an upsert that clears `deleted_at`.
2. Replica B soft-deletes the same id; server commits the tombstone; MQTT/HTTP may or may not reach A.
3. A reconnects: snapshot or row image upserts the tombstone, then `rebasePending` re-runs the upsert (revive) **or** upload loses the race and the tombstone stays — LWW by **server arrival**, not by local rebase order.
4. Kill between tombstone upsert and rebase (same SQLite txn — should be atomic **if** the journal commits). Kill after server apply of revive before peers refetch.
5. Asymmetric partition: B sees tombstone, A sees live revive, HTTP reconcile delayed (30s product / foreground gate).

Violation: after the later-arriving mutation has been applied on the server and a replica has completed merge+rebase, that replica’s live-vs-tombstone for the id disagrees with the server, or a domain row is physically absent (no tombstone) after a successful delete replay.

## Key observations

- Revive is a **claimed** outcome of rebase-onto-tombstone for upserts that clear `deleted_at`. The property is agreement + no hard-delete, not “delete always stays dead.”
- Snapshots that omit tombstones would look like “row gone” on a replace-style merge; this engine upserts, so a missing tombstone in a snapshot **fails to propagate delete** (stale live row) — the dual of wipe.
- `rebasePending` swallows `MutationError` and keeps the queue; UI can look live while server is tombstoned until upload rejects or a later mutation arrives.
- Upload **reject** stores `sync_engine_write_rejections` and soft-deletes the queue row; it does **not** revert domain. The next confirming snapshot (no pending rebase) upserts the server `deleted_at`. Pin `pending-reject-surfaces-write-rejections` needs a later bump + `assertConverged` before domain matches server.
- Product use-case mutations (spaces leave/end, friends remove/block) `SET deleted_at`. Wrap throws `NO_HARD_DELETE` on classified domain `DELETE`. Residual is unclassifiable SQL (`parse_error` DELETE on `run` can fall through — SUT A7, not product authoring).
- MQTT is lossy; `wakeAll` / reconcile tick run only while foregrounded (`QUERY_RECONCILE_INTERVAL_MS = 30_000`). Safety is after HTTP snapshot apply (or explicit refetch), not MQTT-only agreement.
- Framework tables may still hard-delete; domain tables must not.

## Open questions

None remaining after the investigation below.

## Instrumentation status

All missing (`existing-assertions.md`: no Antithesis SDK).

Suggested (do not exist today):

- `Always` — no domain table row is removed by `DELETE FROM` in mutation apply/replay (NO_HARD_DELETE).
- `Always` — after a replica applies a snapshot or confirming (non-optimistic) row image for a scope, every id in that payload exists locally with the payload’s `deleted_at`.
- `Always` — after server replay of mutation M on id X, every replica that has completed a subsequent full snapshot of a scope containing X matches the server’s live-vs-tombstone for X.
- `Sometimes(cond)` — pending rebase revives a row whose local `deleted_at` was non-NULL immediately before rebase.
- `Unreachable` — a replica has a live row (`deleted_at IS NULL`) for an id the server has as a tombstone **and** that replica’s last applied snapshot checkpoint is ≥ the server’s tombstone write, with no later revive mutation applied.

### Investigation Log

#### After rebase revives locally, if upload is rejected, is the local row supposed to return to tombstone on the next snapshot?

- Examined: `mutation-upload-queue.ts` `applyUploadResult` (reject → `storeRejection` + soft-delete queue row; `clearOptimisticRowsForMutation` only on applied); `merge.ts` `rebasePending`; pins `pending-reject-surfaces-write-rejections.sim.test.ts`, `rebase-throw-hidden-until-upload-reject.sim.test.ts`.
- Found: reject does not rewrite domain. After reject the revive can stay live locally until a later snapshot+rebase (queue empty) applies the server tombstone. The reject pin mutates a bump row and `assertConverged` before asserting the pre-reject body. Rebase-throw hides optimistic effect *before* upload; reject-after-successful-rebase is the other path.
- Not found: a reject handler that SETs `deleted_at` back to the server value in the same ack txn.
- Conclusion: resolved — next confirming snapshot must re-tombstone; reject itself may leave the row live. Always stays post-snapshot, not post-reject.

#### Do product mutations always set `deleted_at` and never issue domain `DELETE`?

- Examined: `rg 'DELETE FROM'` under `libs/**/use-cases/**/shared/*mutation*`; spaces `leave` / `end` / `remove-space-user` / `closeSession`; friends `friendship-repository` / `user-block-repository`; `wrap-mutation-db.ts` classify + `parse_error` branch.
- Found: product mutations `SET deleted_at`. No `DELETE FROM` in use-case mutation SQL. Wrap throws `NO_HARD_DELETE` on classified domain delete. `run` throws `UNCLASSIFIABLE_SQL` for `parse_error` whose head is INSERT/UPDATE; a `parse_error` DELETE head falls through to `tx.run`.
- Not found: a product mutation that issues domain `DELETE FROM`.
- Conclusion: resolved for authored product SQL. The Always “no domain DELETE on apply/replay” still tests wrap + residual unclassifiable DELETE (A7), not a product leave/end authoring hole.

#### Is “agree after converge” allowed to use the 30s reconcile tick, or must MQTT-only paths also agree?

- Examined: `subscription-constants.ts` `QUERY_RECONCILE_INTERVAL_MS = 30_000`; `subscription-runtime.ts` `onLifecycle` / `enqueue` / `wakeAll` (no-op unless `foregrounded`); `app-sync-lifecycle.ts` AppState/visibility → background clears the tick.
- Found: MQTT is a lossy optimization (SUT / README claim). Background pauses reconcile and wakes. A replica can disagree with the server until the next foreground HTTP snapshot.
- Not found: a requirement that MQTT-only delivery converge live-vs-tombstone.
- Conclusion: resolved — Always is after a completed snapshot/refetch of a scope containing the id (quiet period or explicit `POST /api/query`), not MQTT-only. Do not fire Always during the intended lag window.
