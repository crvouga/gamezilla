# lww-upload-arrival-under-partition

Focus: Distributed Coordination (no Raft / no quorum). This SUT’s “consensus”
substitute for social state is **server-authoritative last-write-wins by HTTP
upload arrival**.

## Why this property

`sut-analysis.md` states two write planes. Sync is not a CRDT and does not
compare `updated_at`. Two devices (or one device offline, one online) can
diverge under partition; after heal they must agree on whatever Postgres last
applied. Clock skew and MQTT delivery order must not pick a different winner
than arrival.

There is no leader election on this path. `acquireLock` in
`pkgs/sync-engine/src/server/sync-app-mutations-route.ts` (lines 45–51) is an
explicit no-op. Serialization is “outer request txn + unique mutation id.”
Postgres isolation is default READ COMMITTED.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/mutations/server/process-mutations-batch.ts` `processMutationsBatch` | One HTTP POST batch: sort by client `seq`, replay in that order. Across concurrent POSTs, commit order is arrival. |
| `pkgs/sync-engine/src/mutations/server/replay-mutation.ts` `applyReplayMutationInTxn` | `env.now` pinned to `m.createdAt` (line 67). Row timestamps come from the writer, not arrival. Then `INSERT sync_engine_mutations_applied`. |
| `pkgs/sync-engine/src/server/sync-app-mutations-route.ts` `mergeCaptures` | “Later captures win (batch order)” (line 71) for fanout images only. |
| `pkgs/sync-engine/src/client/merge-upsert.ts` `upsertRowsIntersect` | Snapshot/fanout upsert of intersecting columns **verbatim**, including `deleted_at` (comment at 138–140). No `updated_at` compare. |
| `pkgs/sync-engine/src/client/merge.ts` `applyFullMerge` / `applyRowImages` | Single-flight per `SqlClient`; rebase pending `sync_engine_mutations` on top of the snapshot. |
| `pkgs/sync-engine/src/tests/scenarios/mutation-storm-batching-order-preserved.sim.test.ts` | In-sim pin: offline queue drain; LWW body matches seq order **within one client**. |
| `pkgs/sync-engine/src/tests/scenarios/replay-pins-now-to-mutation-created-at.sim.test.ts` | Clock skew must not change replay stamps. |
| `pkgs/sync-engine/src/tests/scenarios/rebase-onto-peer-tombstone-pinned-semantics.sim.test.ts` | Pending upsert can **revive** a server tombstone after upload — still LWW-by-arrival. |

## Failure scenario

1. Devices A and B (same `actorId`) each mutate the same profile / note / space
   row while partitioned from each other, or while one is partitioned from the
   API.
2. Heal HTTP. Both upload.
3. **Bug if** a client keeps the body whose `updated_at` / `createdAt` is
   later, or the body MQTT delivered last, when a later-arriving upload already
   committed a different body on the server.
4. **Bug if** wall-clock jump on either client or the API isolate changes the
   winner while arrival order is unchanged (`sut-analysis` A2).

Mid-partition, replicas **may** diverge. That is allowed. The safety check is
after heal + foreground reconcile (or explicit `POST /api/query`), and on the
server snapshot at any time: server row is the last applied mutation for that
id.

## Partition / heal instrumentation (SUT)

No Antithesis SDK exists (`existing-assertions.md`: none in the tree). Suggested emissions — all
**missing**:

- `Reachable("sync.http.upload.applied")` after `replayMutation` status
  `applied` (not duplicate).
- `Always("sync.lww.server_matches_last_applied")` in the workload after a
  quiet interval: for each contested row id, Postgres body equals the last
  `mutations_applied` replay that wrote that id.
- `Always("sync.lww.online_replicas_match_server")` after heal of **HTTP**
  (ignore MQTT; do **not** use `paintReady` as the ready gate). Compare
  intersecting columns including `deleted_at` per contested id.
- `Sometimes("sync.partition.multi_writer_conflict")` when two clients have
  different local bodies for the same id **before** heal — proves the workload
  actually created a conflict.
- Pair each partition inject with a named heal: `sync.fault_domain=http`
  (TCP to API Worker / Node Hono), distinct from MQTT. Do **not** treat sim
  `world.partition` / `healAll` as the Antithesis signal — that mesh is
  in-process and **skipped** at `SIM_FIDELITY=max`
  (`product/test/src/setup/TESTING.md`, `isWorldMeshSupported`).

Sim settle (`assertConverged`, `replay-step.ts` `restartClientForConverge`)
heals then nudges pending uploads. Antithesis must check after a real quiet
period, not after a harness `healAll`.

## Existing assertions

In-house oracles only: `seq-monotonicity`, DST `assertConverged` after heal.
**Missing** as Antithesis SDK (`existing-assertions.md`): every assertion above.

## Key observations

- Winner is **not** max(`updated_at`). Replay stamps `now` from `createdAt`,
  then a later arrival overwrites those stamps.
- Within one device’s batch, client `seq` order is the arrival stand-in.
  Across devices, it is which `POST /api/mutations` transaction commits last.
- Pending rebase can revive tombstones. Convergence still means “match
  server,” including a live row the later upload resurrected.
- MQTT fanout can show the loser first; HTTP snapshot is the truth path.

## Open questions

None remaining after the investigation below.

### Investigation Log

#### Under READ COMMITTED with `acquireLock` a no-op, can two concurrent mutation POSTs interleave so neither commit is a total last-writer?

- Examined: `sync-app-mutations-route.ts` `acquireLock` (no-op) + `asNestedTxClient` (inner `replayMutation` txn flattened onto the request txn); `process-mutations-batch.ts` (sort by client `seq` inside one POST); `replay-mutation.ts` `applyReplayMutationInTxn`; wrap `RETURNING *` capture.
- Found: two POSTs are two Postgres transactions. There is no actor lock. `UPDATE` of the **same row** takes a row lock; the later commit’s SET columns win, and `RETURNING *` is that post-image. Different row ids from the two POSTs can both persist — the actor-wide snapshot is not “one of the two client bodies.” Same-id last commit is still a total last-writer of that row, not an arbitrary permutation of column fragments from both SET lists.
- Not found: a path that writes half of mutation A’s SET columns and half of B’s on the same columns of one row.
- Conclusion: resolved — do **not** weaken the per-id invariant to “some applied permutation.” Keep “Postgres body equals the last applied mutation that wrote that id.” Do not require the whole replica to match one client’s optimistic body. Multi-row uniqueness TOCTOU is `concurrent-mutations-noop-lock`, not this property.

#### Does product `paintReady` ever gate the After-heal check?

- Examined: `sync-engine-boot.tsx` (`paintReady = boot.phase === 'ready'`); `use-sync-engine-boot-state.ts` / README (`connect()` does not wait for first-sync); `paint-ready-before-first-sync.md`; product hooks (`use-friends`, `use-current-space-ids`, `my-username`) enable `useQuery` on `paintReady`.
- Found: `paintReady` is an identity-match latch after local engine open. It is true on a cold empty file (`hasSynced` may still be false). UI hooks will read stale/empty local rows if used as a “ready to assert LWW” gate.
- Not found: any code that delays `paintReady` until `waitForFirstSync` / `hasSynced`.
- Conclusion: resolved — After-heal Must **not** use `paintReady`. Check SQLite/Postgres (or `waitForFirstSync` / explicit `POST /api/query`) after HTTP heal + foreground reconcile.
