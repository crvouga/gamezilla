# LWW merge does not wipe or clobber unrelated local state

Focus: Data Integrity. Slug: `lww-merge-no-wipe-clobber`.

## Evidence trail

Sync-engine claims last-writer-wins **by upload arrival**, not timestamp compare and not CRDT. Client merge is **column-intersect upsert**, not “replace table with snapshot.” That claim is load-bearing for data integrity: an empty secondary scope, a `not_modified` refresh, a missing key on the wire, or an empty-username profile seed must not erase live rows or blank columns a peer already holds.

Primary evidence is the merge implementation plus in-tree scenario pins that document prior wipe/clobber mechanisms (empty profile fanout, empty secondary snapshot, local-only column NULL, `not_modified` over pending). Those pins run in-process against a virtual mesh. Antithesis is the class of faults they declined: real MQTT + HTTP asymmetric partition, process kill mid-`applyFullMerge` / `applyRowImages`, and overlapping push vs snapshot.

`existing-assertions.md`: no Antithesis SDK. All suggested assertions below are **missing**.

## Code paths

**Upsert, not replace**

- `pkgs/sync-engine/src/client/merge-upsert.ts` — `intersectCols` keeps only keys present on the incoming row ∩ local schema (“never invent missing keys as NULL”). `upsertRowsIntersect` returns false on `rows.length === 0`. `ON CONFLICT (id) DO UPDATE SET` writes intersecting columns **verbatim**, including `deleted_at`.
- `pkgs/sync-engine/src/client/merge.ts` `runMerge` / `applyFullMerge` — iterates `Object.entries(input.tables)` and upserts; omitted tables are not touched. `applyRowImages` skips `rows.length === 0` before `mergeTable`.
- `pkgs/sync-engine/src/client/subscription-runtime-sweep.ts` — `ok` snapshots call `applyFullMerge`; `denied` calls `detachScope` (scope meta only); `not_modified` does not merge unless local hash drifted (`healNotModifiedIfDrifted`).

**Regressive profile clobber (same-account fanout)**

- `pkgs/sync-engine/src/client/optimistic-fanout.ts` `scrubIncompleteProfileImages` — drops profile images with empty username before MQTT publish. Comment: empty `ensureProfile` seed “upsert wipes a peer's already-assigned handle.”
- `pkgs/sync-engine/src/client/attach-push-handle.ts` `dropRegressiveProfileImages` — receiver-side: refuse to apply an empty username when the local profile already has a non-empty one.
- Pin: `pkgs/sync-engine/src/tests/scenarios/same-actor-empty-profile-fanout-does-not-wipe-peer.sim.test.ts`.

**Other wipe/clobber pins (oracles, not Antithesis coverage)**

- `empty-tables-and-zero-row-snapshot.sim.test.ts` — “empty secondary scope refresh must not wipe domain.”
- `client-column-missing-from-server-snapshot-not-clobbered.sim.test.ts` — local-only `notes.color` survives a peer body update whose snapshot omits `color`.
- `not-modified-does-not-clobber-pending.sim.test.ts` — `not_modified` must leave pending optimistic body intact until a later hash miss rebases.
- `mid-session-authorize-deny-keeps-domain-rows.sim.test.ts` — denied detach must not wipe hydrated domain rows (`detachScope` only soft-deletes `sync_engine_scope_meta`).

**README / contracts (claims to test, not facts)**

- README merge section: per-table column-intersect upsert verbatim; extra server columns ignored; local-only columns not clobbered.
- `CONTRACTS.md`: snapshots include tombstones; unsubscribe/denied clears scope meta only.

## Failure scenario

Two same-account devices (phone + tablet) plus a peer, under real MQTT + HTTP:

1. Phone assigns `profile.username`. Tablet later runs an `ensureProfile`-style empty seed. Optimistic or authoritative row images arrive on `user:{actor}` while HTTP snapshot of a **different** scope is empty or `not_modified`.
2. A secondary session query returns `{ notes: [] }` (or omits `notes`) after the client already holds live notes from another scope.
3. Process kill in `deps.db.transaction` inside `runMerge` / `applyRowImages` (MEMORY journal — see `sqlite-memory-journal-wipe-on-corrupt`): torn upsert vs pending rebase.
4. Asymmetric partition: MQTT delivers a sparse row image; HTTP reconcile later delivers a full snapshot (or the reverse). Overlapping `handlePush` is fire-and-forget; snapshot merge is single-flight per `SqlClient`, push apply is not.

Violation: a replica’s live row disappears, a username becomes empty, or a local-only column becomes NULL, without an authoritative later-arriving mutation that wrote those values.

## Key observations

- Merge is upsert-by-id. Absence in a snapshot is **not** encoded as delete. A future “replace table from snapshot” implementation would fail this property immediately.
- “Unrelated” in the invariant is **both**: ids absent from the incoming batch, and keys omitted on an included row. `intersectCols` + `ON CONFLICT DO UPDATE` only write present keys; omitted tables in `applyFullMerge` are not touched.
- Verbatim upsert means a **present empty** username **would** clobber; integrity depends on the two scrubbers plus topic-map hygiene, not on merge itself. Product `ensureProfile` assigns a non-empty username before INSERT (or throws); empty-username images are the Acme `ensureProfileEmpty` fixture (or a hostile/stale MQTT payload).
- `applyFullMerge` does not run `filterDeviceOwnedRows` (that filter is push-only). Empty/wrong snapshots are the wipe surface for HTTP; MQTT is the clobber surface for sparse images.
- Contig check in `tryApplyFanoutRows` runs **before** `applyRowImages` / `withMergeSingleFlight`. Two in-flight `handlePush` calls can both pass `isContiguousNext` for the same next seq. Check the invariant after both complete, not per-message.
- `PRAGMA journal_mode = MEMORY` has no durable rollback journal. A mid-merge kill can tear the file; wipe-on-corrupt then deletes it. This Always applies only after a successful open of an intact file — torn/wiped DBs are `memory-journal-crash-wipes-queue`.
- Sim pins heal the mesh then check. Mid-fault safety is the gap Antithesis uniquely covers.

## Open questions

None remaining after the investigation below.

## Instrumentation status

All missing (`existing-assertions.md`: no Antithesis SDK).

Suggested (do not exist today):

- `Always` — after any committed merge/push apply on an intact DB file, for each local domain row: if the incoming batch did not include that `id`, the row’s intersecting columns are unchanged; if a key was omitted on an included row, that local column is unchanged.
- `Always` — a local `profile.username` that is a non-empty string is never replaced by `''` or NULL from a peer image.
- `AlwaysOrUnreachable` — `not_modified` without local-hash drift does not call `applyFullMerge`.
- `Reachable` — empty secondary snapshot applied (`tables[T].length === 0` or table omitted) while other live rows for `T` exist.
- `AlwaysOrUnreachable` — `dropRegressiveProfileImages` / `scrubIncompleteProfileImages` dropped at least one row (product `ensureProfile` does not emit empty username; Reachable needs a hostile/stale image or Acme-shaped fixture).

### Investigation Log

#### Does product `ensureProfile` still emit an empty-username image on the write-capture path, or only the Acme fixture?

- Examined: `libs/profile/src/use-cases/ensure-profile/shared/ensure-profile-mutation.ts` `seedProfile` / `ensureProfileMutation.run`; `assign-unique-username.ts`; Acme `pkgs/sync-engine/src/tests/apps/acme/shared/profile-mutations.ts` `ensureProfileEmpty`; pin `same-actor-empty-profile-fanout-does-not-wipe-peer.sim.test.ts`.
- Found: product `seedProfile` loops `generateRandomUsername` and INSERTs that non-empty name, or throws `USERNAME_TAKEN` if all attempts collide. `ON CONFLICT (id) DO NOTHING`, then `assignUniqueUsernameIfEmpty`. Acme `ensureProfileEmpty` is an explicit empty-username INSERT labeled “bug-repro seed.”
- Not found: a product write-capture path that inserts `username=''`.
- Conclusion: resolved — empty image is Acme-only (plus hostile/stale MQTT). Scrubbers are defense-in-depth. Catalog Reachable for “dropped regressive image” becomes `AlwaysOrUnreachable` unless the workload injects an empty image.

#### After a mid-merge process kill, is the SQLite transaction atomic under `journal_mode=MEMORY`?

- Examined: `pkgs/sql-client/src/sqlite/connection-pragmas.ts` (MEMORY + temp_store MEMORY on every Bun/web SQLite connection); `web-sqlite-impl.ts` first-open-failure → `deleteDatabaseAsync`; `impl-sqlite-mem.ts` same pragma; `memory-journal-crash-wipes-queue.md`.
- Found: the tree does not claim crash-atomicity. MEMORY stores the rollback journal in RAM (pragma comment: avoid OPFS `-journal` sidecars). Wipe-on-corrupt deletes the identity file on open failure. `merge.ts` `runMerge` / `applyRowImages` wrap upsert+rebase in one `db.transaction`, which is atomic only if the commit finishes.
- Not found: an in-tree test that a SIGKILL mid-`applyFullMerge` leaves a consistent file under native web SQLite. Sibling property still asks whether iOS honors MEMORY.
- Conclusion: resolved for this property — mid-merge kill is **not** treated as atomic. Always is scoped to a successful open of an intact file. Torn/wiped files belong to `memory-journal-crash-wipes-queue`.

#### Is “unrelated” defined as rows whose `id` is absent from the incoming batch, or also columns present locally but omitted on the wire?

- Examined: `merge-upsert.ts` `intersectCols` / `upsertRowsIntersect`; `merge.ts` `runMerge` (iterates `Object.entries(input.tables)`); `applyRowImages` skips `rows.length === 0`.
- Found: omitted ids are never written (upsert-by-id only). Omitted keys are excluded from the `INSERT … ON CONFLICT DO UPDATE` column list (`hasOwnProperty` ∩ `PRAGMA table_info`). Omitted tables are not visited.
- Not found: a path that expands a sparse row to the full local schema with NULLs.
- Conclusion: resolved — the catalog check needs **both** absent ids and omitted keys. Property prose already covers both.

#### Can two overlapping `handlePush` calls both pass the contiguous `pushSeq` check and apply sparse images out of order relative to a snapshot?

- Examined: `attach-push-handle.ts` `tryApplyFanoutRows` (`readLastPushSeq` → `isContiguousNext` → `applyRowImages`); `push-applied.ts` `isContiguousNext` (exactly `last+1`, or true when baseline is null); `merge.ts` `withMergeSingleFlight`.
- Found: contig check and `recordPushApplied` are outside the merge gate. Two overlapping calls that both read `last=N` can both pass for `N+1`. Applies serialize on the gate but both still upsert. Snapshot `applyFullMerge` is the same gate, so a check-then-enqueue push can apply after the snapshot (`stale-push-images-after-snapshot-merge`).
- Not found: a combined txn that holds the contig read through apply+record.
- Conclusion: resolved — yes. Invariant must be checked after overlapping applies complete, not per-message. Push-vs-push is `overlapping-handle-push-seq-toc-tou`; this property still needs post-quiescence column checks.
