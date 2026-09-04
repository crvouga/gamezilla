# three-seq-spaces-unconflated

Focus: Protocol Contracts. Lead: SUT analysis serialization table — “Three sequences. Must not be conflated: checkpoint (query scope), pushSeq (topic), client mutation `seq`.” README § Sequences repeats the table.

## Claim

The three monotonic spaces stay distinct on the wire and in local tables. A value from one space must not be stored or compared as if it belonged to another. Snapshots, fanout apply, and upload drain each consult only their own space.

| Space | Scope | Wire / table | Allocator |
|---|---|---|---|
| `checkpoint` | Per subscribed query scope | `POST /query` `checkpoint` / `last_checkpoint` | Isolate-local `createMonotonicCheckpoint` (`${epochMs}${seq padded 6}`) |
| `pushSeq` | Per pubsub topic | `PushMessage.pushSeq`, `topicPushSeqs`, `sync_engine_topic_seq.n`, `sync_engine_push_applied.last_push_seq` | Postgres atomic upsert; decimal string of `n` |
| `seq` / `ackSeq` | Per client upload identity | mutation row `seq`, batch `ackSeq` | Client-local increment; server max of applied rows |

## Code paths

- `pkgs/sync-engine/README.md` “Sequences” — explicit “do not conflate.”
- `pkgs/sync-engine/src/shared/commit-checkpoint.ts` — query checkpoints embed wall `now()` + padded seq so NTP/skew cannot emit a value ≤ a client’s `last_checkpoint`. Comment: embedding `now()` alone would drop every later snapshot as stale forever.
- `pkgs/sync-engine/src/server/create-sync-app.ts` — allocator is **per Hono app / isolate**, not a DB sequence. Remake without `initialLast` can mint values below a peer’s stored checkpoint.
- `pkgs/sync-engine/src/server/allocate-topic-push-seq.ts` — pushSeq is `String(n)` from `sync_engine_topic_seq`. Comment: “not Date.now()+ackSeq” so peers can detect gaps with exact-next checks.
- `pkgs/sync-engine/src/server/sync-app-mutations-route.ts` — **naming collision:** `prepareMutationNotify` stores allocated **pushSeqs** in a field called `checkpoints`, then `publishPushMessages({ pushSeqs: prepared.checkpoints })` and returns them as `topicPushSeqs`. `ackSeq` is a separate client-seq max.
- `pkgs/sync-engine/src/client/push-applied.ts` — `compareCheckpoint` is a shared bigint-string compare used for **both** query checkpoints (`merge.ts` `isStale`) and topic `pushSeq`. Legacy wall-clock floor `10^15` exists because Phase-2 REST used `${Date.now()}000000` — the same *shape* as today’s query checkpoints.
- `pkgs/sync-engine/src/client/mutation-upload-queue.ts` — ack floors **topic** `last_push_seq` from `topicPushSeqs` so own echoed fanout is a no-op. That must not write `ackSeq` or a query checkpoint into `sync_engine_push_applied`.
- `pkgs/sync-engine/src/client/attach-push-handle.ts` — row images apply only when `isContiguousNext(last, payload.pushSeq)` (`last + 1`). A query-checkpoint string in `last_push_seq` is ≥ `10^15` → treated as unknown/legacy and healed, or compared as a huge bigint so every real pushSeq looks stale.
- DST oracles (not Antithesis): `seq-monotonicity`, `push-seq-monotonic-per-topic`, `checkpoint-monotonic-per-scope` in `pkgs/sync-engine/src/sim/invariants.ts`.

## Failure scenario

1. **Ack floors the wrong space.** Upload handler writes `ackSeq` (small integer) or a query `checkpoint` (epoch||seq) into `sync_engine_push_applied`. Later MQTT `pushSeq` `N+1` either looks stale (skipped, no refetch) or “contiguous” against the wrong baseline (row images applied across a real topic gap).
2. **Merge uses pushSeq as scope checkpoint.** A snapshot with a lower epoch-shaped checkpoint than a topic seq written into `last_checkpoint` is dropped as stale; peer never heals.
3. **Isolate remake.** New Worker mints query checkpoints below clients’ stored `last_checkpoint` (`createMonotonicCheckpoint` without `initialLast`). Every `ok` snapshot is `isStale` → silent freeze until process high-water catches up. Sim remake can pass `initialLast`; production isolates do not share it.

## Why Antithesis

Sim keeps one `createSyncApp` and one checkpoint allocator for the world lifetime. Antithesis Worker/process kill + real MQTT + concurrent `/mutations` is the class that remints isolate-local checkpoints and interleaves `topicPushSeqs` with query `checkpoint` on the same client. The in-source name `checkpoints` for pushSeqs is a confusion attractor for future patches.

## Instrumentation

`existing-assertions.md`: no Antithesis SDK. Suggested assertions are **missing**:

- `Always`: `sync_engine_push_applied.last_push_seq` is a small integer string (not ≥ `10^15`, not equal to any scope `last_checkpoint`).
- `Always`: `sync_engine_scope_meta.last_checkpoint` never equals a topic `pushSeq` just allocated on the same request.
- `Always`: mutation `ackSeq` is not written to `sync_engine_push_applied`.
- `Reachable`: mutation 200 body contains both `ackSeq` and `topicPushSeqs` with different numeric magnitudes.

In-house substitutes: the three DST monotonicity invariants (in-process, healed settle).

## Open questions

- After a production isolate remake, does any host persist checkpoint high-water, or is regression possible until wall clock + seq exceeds every client’s stored value? `(partial: product createSyncApp does not pass initialLast)`

### Investigation Log

#### Are the three values stored in the same column anywhere?

- Examined: `sync_engine_scope_meta`, `sync_engine_push_applied`, `sync_engine_mutations`, mutation upload ack, `prepareMutationNotify`.
- Found: storage is separate. The collision is **naming and compare helper**: server field `checkpoints` = pushSeq map; `compareCheckpoint` compares both spaces; query format matches the legacy pushSeq wall-clock shape.
- Conclusion: property is “do not conflate at apply/floor time,” not “one column holds three meanings.”

#### Does product persist checkpoint high-water across isolate restart?

- Examined: `create-sync-app.ts` `nextCheckpoint ?? createMonotonicCheckpoint(deps.now).next`; `apps/server` sync mount.
- Found: no `initialLast` from Postgres. Allocator is process-local.
- Not found: a DB sequence or kv high-water for query checkpoints.
- Conclusion: tagged partial — remake regression is a live protocol risk; confirm whether any Worker reuse / DO-style memory exists in the Antithesis topology (likely Node `createServer`, still process-local).
