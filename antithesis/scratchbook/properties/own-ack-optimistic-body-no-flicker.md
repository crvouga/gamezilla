# own-ack-optimistic-body-no-flicker

Focus: Concurrency + claimed safety. Confidence: high.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Fills coverage-balance F10 / wildcard A6. Distinct from `lww-merge-no-wipe-clobber` (peer/empty-image clobber) and `stale-push-images-after-snapshot-merge` (fanout vs newer snapshot on a replica). This is the **writer’s own ack** vs a reordered stale snapshot or own MQTT echo.

## Why this property

SUT `[safety]` and sync-engine README claim: “Optimistic body must not briefly revert to server-old after own ack (lite soft-ack + generation fence).” In-tree pins: `online-mutate-no-optimistic-body-flicker`, `delayed-sync-after-ack-no-optimistic-flicker`. Not previously in the catalog.

Mechanism (claimed, not a fact):

1. Local mutate paints the new body and queues the mutation.
2. Upload returns `applied`. `applyUploadResult` deletes the queue row, `clearOptimisticRowsForMutation`, then `onAckFence` → `runtime.bumpGenerations()` so in-flight **pre-replay** query sweeps are dropped.
3. `topicPushSeqs` from the ack floor `last_push_seq` so own echoed fanout is a no-op.
4. A snapshot that left the server **before** replay, or an MQTT image of the old row, must not apply and flash the stale body.

Reject-only batches do **not** fence (README). That is out of scope here (`rejected-write-still-paints-optimistic`).

Sim pins `advance(25)` in a loop and assert the body never equals anything but `optimistic-final`. They use in-process delay/reorder, not real HTTP/MQTT asymmetry or thread pause after ack before merge.

## Code paths

| File | Role |
|---|---|
| `pkgs/sync-engine/src/client/mutation-upload-queue.ts` `applyUploadResult` | Ack fence only if `appliedAny`; then `recordPushApplied` floors topic seqs. |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` | Wires `onAckFence` → `state.runtime.bumpGenerations()`. |
| `pkgs/sync-engine/src/client/subscription-runtime.ts` `bumpGenerations` | Drops in-flight pre-replay sweeps. |
| `pkgs/sync-engine/src/client/push-applied.ts` | Own-ack floor; comment on healing poisoned rows so the floor can advance. |
| `pkgs/sync-engine/src/client/merge.ts` `applyFullMerge` / `applyRowImages` | Upsert + rebase. After ack the queue is empty, so rebase cannot remask a stale upsert. |
| `pkgs/sync-engine/src/tests/scenarios/online-mutate-no-optimistic-body-flicker.sim.test.ts` | Online mutate, 8 mid-quiescence samples. |
| `pkgs/sync-engine/src/tests/scenarios/delayed-sync-after-ack-no-optimistic-flicker.sim.test.ts` | Reorder/delay + `nudge()` after ack. |

`existing-assertions.md`: no Antithesis SDK.

## Failure scenario

1. Alice and Bob share a row (note / profile / space name). Server has body `seed`.
2. Alice mutates to `optimistic-final`. Local paint. Upload applies on Postgres.
3. In flight: a `POST /api/query` that started before replay, or MQTT image with old `pushSeq` / stale columns, or a delayed 200.
4. Pause after `applied` ack (queue gone, fence not yet, or floor not yet written) and deliver the stale payload.
5. **Violation:** any sample of Alice’s live row between ack and quiescence shows `seed` (or any body ≠ `optimistic-final` that equals a pre-ack server image).

After quiescence the LWW winner should be `optimistic-final` (`lww-upload-arrival-under-partition`). This property is the **mid-window** samples, not the heal.

## Invariant

- `Always` from the writer’s `applied` ack until the next writer-owned mutation on that id: live intersecting columns stay the acked optimistic body (never briefly the pre-ack server image).
- `Reachable`: delayed/reordered snapshot or own fanout arrives after ack.
- `Unreachable`: live body equals the last pre-ack server image after `mutationStatus(id) === 'confirmed'` for that write.

Assertion type is `Always` on every sample (safety), not `Sometimes` — flicker is the bad thing. `Reachable` guides search toward the delayed-sync path the sim already names.

## Antithesis angle

Thread pause after `applyUploadResult` / before `bumpGenerations` or `recordPushApplied`. Asymmetric delay: HTTP query 200 held while mutations 200 returns. MQTT echo of the old image after the ack floor should be a no-op — pause between ack and floor to miss that. First topology: two SQLite clients + real EMQX + API; no DO durability required.

Do not use `paintReady` as the sample gate. Sample the writer’s SQLite after each merge/push apply.

## What goes wrong

The writer sees their own confirmed edit flash back to the old value, then (maybe) return. Looks like a lost write even when Postgres has the new body. Mobile users tap twice; peers may already show the new value.

## Suggested SUT instrumentation (all missing)

- `Always("sync.ack.writer_body_not_pre_ack_image")` after each `applyFullMerge` / `applyRowImages` on a client that has a confirmed mutation on those ids.
- `Reachable("sync.ack.stale_snapshot_dropped_by_generation")` when `bumpGenerations` drops a sweep.
- `Reachable("sync.ack.own_echo_noop_via_pushseq_floor")` when `isContiguousNext` fails because of the ack floor.

## Open questions

None.

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### If the ack 200 omits `topicPushSeqs`, does own MQTT echo still apply as contiguous-next and paint stale columns?

- Examined: `mutation-upload-queue.ts` `applyUploadResult` (floor only if `topicPushSeqs !== undefined`); `sync-app-mutations-route.ts` (includes `topicPushSeqs` iff `pubsub !== undefined && applied.length > 0`); `attach-push-handle.ts` `isContiguousNext`; `push-applied.ts` (`baseline === null` → true).
- Found: product `createSyncApp` always passes a pubsub object, so an **applied** ack on first topology includes `topicPushSeqs`. If the field is omitted (dropped body, or `applied.length === 0` — reject-only, out of scope here): `recordPushApplied` is skipped. Own echo then: `last === null` → `isContiguousNext` true → **stale columns apply**; if `last` is already set, only `last+1` applies (a stale older `pushSeq` is not contiguous).
- Not found: a product applied-ack path that omits `topicPushSeqs` while pubsub is configured.
- Conclusion: resolved — omitted floor lets a stale echo paint when `last_push_seq` is null. Product applied acks normally send the floor. Always still needed; inject omit/`last=null` to hit the hole.

#### Is a post-ack snapshot with a newer checkpoint but older intersecting columns possible?

- Examined: `run-query.ts` (read tables, then `nextCheckpoint()` after hash); product `checkpointSeq`; `subscription-runtime-sweep.ts` `capturedGen`; `bumpGenerations`.
- Found: one `run()` is a consistent read — not mixed-age tables in one response. Across concurrent requests: query A can read old rows, await hash, while B replays and mints a checkpoint; A then mints a **higher** seq with **older** tables. Client defense is `capturedGen !== entry.generation` after `onAckFence`. If the 200 is applied after the fence, the sweep is dropped. If pause is between ack and `bumpGenerations`, A can merge.
- Not found: a server check that the minted checkpoint is ≥ every concurrent snapshot’s read time.
- Conclusion: resolved — newer-checkpoint + older-columns is possible (TOCTOU). Generation fence is supposed to drop it. Not Unreachable. Property Always tests that fence; type unchanged.

#### Do product `useQuery` live reads observe the same SQLite the probe would sample?

- Examined: `pkgs/sync-engine/src/client/sync-engine-context.tsx` `useQuery`.
- Found: comment and implementation: “always returns the current SQLite snapshot (no process row cache).” `engine.watch` + `useSyncExternalStore` on the watch snapshot. First topology is headless (no React).
- Not found: a product hook cache of domain rows that can diverge from SQLite.
- Conclusion: resolved — probe SQLite is what `useQuery` would paint. No independent flicker cache.

## Assumptions

- “Acknowledged” here means wire `applied` and local `mutationStatus === 'confirmed'` (queue gone, no write_rejections).
- First topology headless clients; sample domain tables directly.
- SDK missing.
