# stale-push-images-after-snapshot-merge

Focus: Concurrency. Confidence: high.

## Claim to test (not a fact)

A snapshot `applyFullMerge` at scope checkpoint C must not be clobbered by a later `applyRowImages` whose contig check ran **before** that merge (or whose images are older than C). Merge of snapshots is single-flight per `SqlClient`; MQTT `handlePush` is fire-and-forget and performs `isContiguousNext` **outside** that gate.

Comments on `applyRowImages`: intentionally does **not** update `sync_engine_scope_meta.last_hash` so `not_modified` stays sound. Snapshots also do **not** bump `last_push_seq`. After a refetch, a late contiguous-looking fanout can still apply.

## Why this property

SUT analysis concurrency: “Merge of snapshots **is** single-flight per `SqlClient`” vs “`handlePush` is fire-and-forget.” Sim pin `push-during-inflight-merge-queues-single-flight.sim.test.ts` checks that *queued* merges do not tear mid-flight; it does not pause between `readLastPushSeq` and `withMergeSingleFlight`, which is the window where a snapshot can *finish first* and then the already-checked push applies stale images on top.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Failure scenario

1. Peer last_push_seq = `N`. MQTT delivers `N+1` row images (older body).
2. `handlePush` / `tryApplyFanoutRows` reads last=`N`, `isContiguousNext` true.
3. Pause before `applyRowImages` → `withMergeSingleFlight`.
4. HTTP snapshot (reconcile tick, `wakeAll` after MQTT connect, or `wakeRefetch` from a *gapped* sibling push) runs `applyFullMerge` with checkpoint C and newer columns (or a tombstone).
5. Resume: `applyRowImages` enters the gate **after** the snapshot and upserts the stale `N+1` images.
6. `recordPushApplied(N+1)` advances last_push_seq so the client believes fanout is current. `last_hash` still reflects C (`not_modified` on the next poll) — **heal is suppressed**.

Variant: snapshot is already in the merge gate; push contig check passes; push queues *behind* snapshot (safe). The bug is check-then-enqueue, not the gate itself.

Optimistic fanout (`tryApplyOptimisticRows`) skips the pushSeq floor entirely and also calls `applyRowImages` — a third writer in the same gate with no contig.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/client/attach-push.ts` `subscribeTopic` | Fire-and-forget `handlePush`. |
| `pkgs/sync-engine/src/client/attach-push-handle.ts` `tryApplyFanoutRows` (~98–107) | Contig check then `applyRowImages` (no combined txn with the check). |
| `attach-push-handle.ts` `tryApplyOptimisticRows` (~23–46) | Applies images without `last_push_seq`. |
| `pkgs/sync-engine/src/client/merge.ts` `withMergeSingleFlight` (~52–63) | `WeakMap` per `db` object; `chain.then(write, write)`. |
| `merge.ts` `applyFullMerge` / `runMerge` (~162–202) | Stale-check on `last_checkpoint`; upsert tables; `touchScopeMeta`; `rebasePending`. |
| `merge.ts` `applyRowImages` (~232–277) | Same upsert + rebase; **does not** touch `last_hash` / `last_checkpoint` (comment ~225–227). |
| `pkgs/sync-engine/src/client/push-applied.ts` | Snapshots never write `sync_engine_push_applied`. |
| `pkgs/sync-engine/src/tests/scenarios/push-during-inflight-merge-queues-single-flight.sim.test.ts` | In-sim “no torn intermediate”; not the check-then-merge window. |

## What goes wrong if violated

Same wipe/clobber class as empty-profile fanout: snapshot had the assigned username; late `N+1` seed image blanks it; `not_modified` keeps the blank. Device-private `spaces_open_sessions` filter runs inside `applyRowImages` but cannot save a stale *allowed* column. User sees “solved then not” / “left but still seated” until a later snapshot with a *higher* checkpoint.

## SUT instrumentation (all missing)

- `Reachable` — snapshot merge completed while a fanout apply was past contig-check and not yet in the gate (`sync.merge.push_checked_before_snapshot`).
- `Always` — after any `applyRowImages` that follows an `applyFullMerge` for an overlapping table, row columns are not older than that merge’s snapshot for intersecting ids (`sync.merge.no_stale_fanout_after_snapshot`). Compare **server** (or a peer with no pending rewrite of those columns) — not the writer’s DB after `rebasePending`, and not `last_hash` (fanout does not update it).
- `Always` — `last_push_seq` advance must not hide a local row that is behind the last applied snapshot checkpoint (`sync.merge.push_floor_not_a_heal_skip`).
- `Sometimes(cond)` — push and snapshot both applied in one run with overlapping tables (`sync.merge.push_and_snapshot_overlap`).

## Open questions

None remaining after the investigation below.

### Investigation Log

#### Does `rebasePending` after a stale fanout re-apply local mutations and mask the clobber for the uploading client?

- Examined: `merge.ts` `applyRowImages` (always `rebasePending` after upsert, same txn); `rebasePending` re-runs queued `sync_engine_mutations` with `now` pinned to `created_at`.
- Found: yes. A writer with a pending mutation that writes the clobbered columns will rebase those values back on. A peer with an empty queue keeps the stale image. `applyFullMerge` rebases too, so the mask is “has pending that rewrites those cols,” not “is the uploading client” per se.
- Not found: a skip of rebase on authoritative (non-optimistic) `applyRowImages`.
- Conclusion: resolved — Always compares replicas **without** a pending rewrite of those columns (or compare to server), not the writer’s DB after rebase.

#### Is `filterDeviceOwnedRows` the only semantic filter on fanout, or does `dropRegressiveProfileImages` run only on optimistic payloads?

- Examined: `attach-push-handle.ts` `tryApplyOptimisticRows` (calls `dropRegressiveProfileImages`) vs `tryApplyFanoutRows` (applies `capped` with no profile scrub); `merge.ts` `filterDeviceOwnedRows` inside `applyRowImages` only.
- Found: regressive-profile drop is optimistic-only. Authoritative fanout can still blank a username (overlaps `lww-merge-no-wipe-clobber`). Device-owned filter runs on every `applyRowImages` (optimistic and authoritative), not on `applyFullMerge`.
- Not found: a second authoritative-path username scrub.
- Conclusion: resolved — confirmed. This property’s stale-image Always is column-age vs the snapshot, including an allowed username clobber on the authoritative path.

#### If `not_modified` skips, how long can the clobber last?

- Examined: `applyRowImages` comment (does not update `last_hash` / `last_checkpoint`); `subscription-runtime.ts` `onLifecycle` (background clears reconcile tick and skips `wakeAll`); `QUERY_RECONCILE_INTERVAL_MS = 30_000`.
- Found: after stale apply, `last_hash` still reflects snapshot C, so the next poll can be `not_modified` and skip merge. While foregrounded, the safety-net tick is 30s (and any other wake). While backgrounded, wakes and the tick are off — the clobber can last until foreground + a snapshot that is not `not_modified` (hash miss or higher checkpoint).
- Not found: a product SLO that a clobber must heal within N seconds.
- Conclusion: resolved — keep this as **safety after a confirming snapshot**, not a 30s liveness bound. Unbounded while backgrounded is intended lifecycle, not a second assertion type.

## Related

- `overlapping-handle-push-seq-toc-tou` — push-vs-push on the same contig read; this is push-vs-snapshot.
- Wipe/clobber sim pins (empty profile, `not_modified` clobbering pending) — mechanisms to re-hit under real MQTT+HTTP interleaving.
