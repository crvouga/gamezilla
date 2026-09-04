# overlapping-handle-push-seq-toc-tou

Focus: Concurrency. Confidence: high.

## Claim to test (not a fact)

For a given MQTT topic, two overlapping `handlePush` invocations must not both treat the same `pushSeq` as the contiguous next, and must not apply row images for a `pushSeq` that is not exactly `last_push_seq + 1` when a baseline exists. `sync_engine_push_applied.last_push_seq` must never regress.

Docs / comments claim fanout apply is gated by exact-next contiguity (`isContiguousNext`); gaps fall back to HTTP refetch. The contig check is a read-then-act that spans awaits and is **not** inside the merge single-flight lock.

## Why this property

SUT analysis A10 and concurrency hotspot: `handlePush` is fire-and-forget per MQTT message. Subscribe callback does `void handlePush(...).catch(...)`. Two `N+1` deliveries (QoS1 redelivery, duplicate publish, or two in-flight messages after a pause) can both pass `readLastPushSeq` before either `recordPushApplied`.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**. In-house DST `push-seq-monotonic-per-topic` is a settle-time oracle, not a mid-overlap check.

## Failure scenario

1. Client subscribed; `last_push_seq` for topic T is `N` (or `NULL` after subscribe / `clearRemovedPushApplied`).
2. Two MQTT payloads arrive close enough that both enter `handlePush` before either records.
3. Pause the isolate between `readLastPushSeq` and `applyRowImages` / `recordPushApplied` (or between `handlePush`’s first read and `tryApplyFanoutRows`’s second read).
4. Both see the same baseline.

Concrete windows:

- **Duplicate `N+1`:** both `isContiguousNext(N, N+1)` true. Both call `applyRowImages` (serialized by merge gate) then `recordPushApplied`. Product QoS1 redelivery and a retried publish are the **same** payload (allocate is monotonic; publish is not retried). Same rows twice is an upsert no-op; the Always that still fails is `last_push_seq` regressing via the record TOCTOU, not a second image for the same seq.
- **Unknown baseline:** `isContiguousNext(null, anything)` is `true`. First subscribe (no row), a topic **dropped** then re-added (`clearRemovedPushApplied` soft-deletes only non-retained topics), or legacy-heal: overlapping `5` and `1` both apply as “contiguous.” Partial row images from a gapped seq land without refetch. Remake of still-subscribed topics does **not** null `last`.
- **Record TOCTOU:** `recordPushApplied` itself reads last then `INSERT … ON CONFLICT DO UPDATE`. Two writers can both decide `pushSeq > prev` and the later write can *skip* if the first already stored a higher seq — or overwrite if comparison races. The `ON CONFLICT` does not `GREATEST` the seq; it writes `excluded.last_push_seq`. Confirmed in source: pause between the re-read and the upsert lets a stale `N+1` clobber a refetch-committed `N+2`.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/client/attach-push.ts` `subscribeTopic` (~118–124) | `void handlePush(bag, topic, data)` — no per-topic queue. |
| `pkgs/sync-engine/src/client/attach-push-handle.ts` `handlePush` (~134–172) | Parse → `readLastPushSeq` → drop if `pushSeq <= last` → `tryApplyFanoutRows` or `wakeRefetch`. |
| `attach-push-handle.ts` `tryApplyFanoutRows` (~86–112) | **Second** `readLastPushSeq` + `isContiguousNext` **outside** `withMergeSingleFlight`. Then `applyRowImages` then `recordPushApplied`. |
| `pkgs/sync-engine/src/client/push-applied.ts` `isContiguousNext` (~45–58) | `baseline === null` → `true` (any seq applies). Else exact `+ 1n`. |
| `push-applied.ts` `readLastPushSeq` (~61–84) | SELECT; legacy wall-clock baseline is soft-deleted then treated as unknown. |
| `push-applied.ts` `recordPushApplied` (~101–129) | Read last again; skip if `pushSeq <= prev`; upsert `last_push_seq = excluded` (not monotonic GREATEST). |
| `pkgs/sync-engine/src/client/merge.ts` `withMergeSingleFlight` | Serializes *writers* only. Contig checks run before entering the gate. |
| `pkgs/sync-engine/src/sim/invariant-tracker.ts` `checkPushSeqMonotonicPerTopic` | Settle-only; never sampled during overlap. |

## What goes wrong if violated

Peer local SQLite shows a torn or stale row image (username blanked, space membership wrong, tombstone revived) while `last_push_seq` claims the topic is caught up — so reconcile may `not_modified` and not heal until 30s / next membership wake. Unknown-baseline double apply is the wipe/clobber class (empty profile fanout) under real MQTT reordering.

## SUT instrumentation (all missing)

- `Reachable` — two `handlePush` for the same topic in flight (`sync.push.overlap_inflight`).
- `Reachable` — `isContiguousNext` true with `last === null` (`sync.push.contig_unknown_baseline`).
- `Always` — after `recordPushApplied`, stored `last_push_seq` ≥ every previously recorded seq for that topic (`sync.push.last_seq_never_regresses`).
- `Always` — if `last` was non-null at apply time, applied `pushSeq === last + 1` (`sync.push.apply_only_exact_next`).
- `Sometimes(cond)` — overlapping deliveries of the same topic observed and both completed (`sync.push.overlap_completed`).

## Open questions

- None

## Related

- `stale-push-images-after-snapshot-merge` — same fire-and-forget vs merge-gate split; that property is snapshot-vs-push, this one is push-vs-push.
- DST `push-seq-monotonic-per-topic` — port the oracle; do not treat sim settle as coverage of the overlap window.

### Investigation Log

#### Does product EMQX QoS ever redeliver the same pushSeq with a different rows bag?

- Examined: `allocate-topic-push-seq.ts` (atomic `n + 1` per topic); `notify-channels.ts` (`failures are logged, never retried`); `publishPushMessages` (one payload per allocated seq); `create-emqx-pubsub.ts` QoS1; `existing-assertions.md`.
- Found: each `pushSeq` is minted once and published once. Broker QoS1 redelivery is the same MQTT packet. No in-tree retry that rebuilds `rows` under the same seq.
- Not found: a path that re-publishes a new row bag with a reused seq (optimistic uses `pushSeq: '0'`, a different path).
- Conclusion: resolved — duplicate `N+1` is identical upsert. High-value Always is unknown-baseline apply + `recordPushApplied` TOCTOU. SDK still **missing**.

#### After clearRemovedPushApplied on topic remake, is last always null?

- Examined: `push-applied.ts` `clearRemovedPushApplied` / `readLastPushSeq`; `attach-push.ts` `remake` and `syncTopicsIncremental`.
- Found: clear soft-deletes only topics **not** in `retainedTopics`. Remake and incremental both pass `desired.keys()`, so still-subscribed topics keep `last_push_seq`. `readLastPushSeq` ignores `deleted_at IS NOT NULL`. Last is null on first subscribe, after a topic is dropped then re-added, or after legacy-heal.
- Not found: a remake that wipes retained topics.
- Conclusion: resolved — remake of a live topic does not open the unknown-baseline window. Membership-churn (drop + re-add) or first subscribe still does.

#### Is recordPushApplied ON CONFLICT ever a regression?

- Examined: `recordPushApplied` read-then-`ON CONFLICT DO UPDATE SET last_push_seq = excluded.last_push_seq` (no `GREATEST`); callers `tryApplyFanoutRows` and `commitPendingPushSeqs`.
- Found: skip is only `pushSeq <= prev` at **this** call’s re-read. A pause before the upsert lets a stale lower seq overwrite a higher one already stored.
- Not found: a SQL-level monotonic guard.
- Conclusion: resolved — the TOCTOU is real in source. Keep `Always` `sync.push.last_seq_never_regresses`. SDK **missing**.
