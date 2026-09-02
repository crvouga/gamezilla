# mqtt-http-independent-fault-domains

Focus: Distributed Coordination. MQTT (EMQX WSS subscribe + Worker HTTP
publish) and sync HTTP (`POST /api/query`, `POST /api/mutations`) are
**independent fault domains**. There is no Raft; snapshots are the claimed
truth path and MQTT is a lossy optimization.

This property also covers **EMQX session vs HTTP refetch**: session expiry
(600s), `close()` wiping the session (`sessionExpiryInterval: 0`), overflow,
and allocate-then-drop `pushSeq` gaps must all fall back to HTTP.

## Why this property

`notifyChannels` allocates a monotonic `pushSeq` in Postgres **then**
fire-and-forget publishes. Failures are logged, never retried
(`pkgs/sync-engine/src/server/notify-channels.ts` lines 29–35, 93–95). A kill
or partition between allocate and publish leaves a **permanent seq gap**.
Clients refuse non-contiguous row images (`isContiguousNext`) and wake an
HTTP refetch instead.

Product reconcile is 30s and **pauses while backgrounded**
(`QUERY_RECONCILE_INTERVAL_MS`, `subscription-runtime.ts`
`startReconcileTick` requires `foregrounded`). Sim uses 500ms.

EMQX client: MQTT 5 `clean: false`, `sessionExpiryInterval: 600`
(`pkgs/pubsub-emqx/src/create-emqx-pubsub.ts`). `close()` ends with
`sessionExpiryInterval: 0` so remake does not leave an orphan mqueue
(`attach-push.ts` remake comment, lines 128–131). QoS1 is not claimed
eventually delivered. Broker URL itself is a **synced `client_config` row**
— cold start is HTTP-only until that row hydrates.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/server/allocate-topic-push-seq.ts` | Allocates strictly monotonic per-topic `pushSeq`. |
| `pkgs/sync-engine/src/server/notify-channels.ts` `notifyChannels` / `publishPushMessages` | Allocate then best-effort `pubsub.publish`. Catch-and-log on allocate; `.catch` on publish. |
| `pkgs/sync-engine/src/client/attach-push-handle.ts` `handlePush` / `tryApplyFanoutRows` / `wakeRefetch` | Contiguous + images → apply; else wake HTTP scopes. Non-contiguous / older seq dropped. |
| `pkgs/sync-engine/src/client/push-applied.ts` `isContiguousNext` | `pushSeq === last + 1` or unknown baseline. |
| `pkgs/sync-engine/src/client/subscription-constants.ts` | Product 30s / sim 500ms safety-net refetch. |
| `pkgs/sync-engine/src/client/subscription-runtime.ts` `startReconcileTick` | Tick only if running **and** foregrounded. |
| `pkgs/sync-engine/src/client/attach-push.ts` `remake` | `pubsub.close()` wipes MQTT session. |
| `pkgs/pubsub-emqx/src/create-emqx-pubsub.ts` | `EMQX_SESSION_EXPIRY_SEC = 600`; reconnect `clean: false`; `close()` expiry 0. |
| `pkgs/sync-engine/src/tests/scenarios/push-without-row-images-wakes-refetch.sim.test.ts` | PushSeq-only still wakes peers. |

## Failure scenario

**Asymmetric partition (the Antithesis unique value vs in-process mesh):**

- MQTT down, HTTP up: writer uploads; peers must still converge via query
  refetch / 30s tick. **Bug if** a peer stays stale forever because
  `handlePush` never ran.
- HTTP down, MQTT up: a client may apply row images (or not, if publish
  also failed). It must **not** upload. After HTTP heals, queue drains and
  LWW applies. **Bug if** MQTT-only images are treated as acked uploads.
- Allocate-then-drop: server `pushSeq` advanced, publish lost. Next MQTT
  message is non-contiguous → must refetch, not skip forever.
  **Hazard:** `commitPendingPushSeqs` runs in `setAfterSweep` after
  `runSubscriptionSweep` returns — including `not_modified`, `denied`, and
  generation-skipped applies. It records the pending seq if **any** topic
  scope was in the swept list, without checking that `applyFullMerge` (or
  `healNotModifiedIfDrifted`) filled the hole. A later contiguous MQTT
  apply then skips the hole. The Always oracle is **domain rows vs
  server**, not `last_push_seq` advancing.
- Session expiry / overflow: after 600s disconnect or mqueue drop, resume
  is not a complete history. HTTP refetch is the catch-up. **Bug if** the
  client records a high `last_push_seq` without applying intervening rows
  (or refetching).
- `handlePush` is fire-and-forget per message (`attach-push.ts` line 120).
  Two overlapping `N+1` deliveries can both pass the contiguous check
  (`sut-analysis` concurrency). Merge of snapshots **is** single-flight.

## Partition / heal instrumentation (SUT)

All **missing** (no SDK). Emit separately per domain — a single
“network partitioned” bit hides the interesting cases:

- `Sometimes("sync.fault.mqtt_down_http_up")` when MQTT status is `down`
  and a `POST /api/query` or `/mutations` succeeds.
- `Sometimes("sync.fault.http_down_mqtt_up")` when HTTP throws
  `HttpNetworkError` and an MQTT message is still received.
- `Sometimes("sync.pushseq.gap_then_http_refetch")` when
  `isContiguousNext` is false and `wakeRefetch` runs.
- `Sometimes("sync.emqx.session_expired_then_http_catchup")` after
  disconnect ≥ 600s (or broker session drop) followed by a successful
  snapshot merge.
- `Reachable("sync.pushseq.allocate_without_publish")` if the SUT can
  detect publish `.catch` after allocate (or a test hook between the two).
- `Always("sync.http.heal_converges")` after HTTP heal + foreground
  reconcile: peer domain rows match server for subscribed scopes.
  Do **not** treat `last_push_seq` equal to the latest allocated seq as
  the heal signal (`commitPendingPushSeqs` can floor past a hole).
- `Reachable("sync.pushseq.commit_pending_without_full_merge")` when
  `recordPushApplied` runs from `commitPendingPushSeqs` after a sweep
  whose overlapping scopes were `not_modified` without heal, `denied`,
  or generation-skipped.
- `Unreachable("sync.mqtt_only.treated_as_upload_ack")` — local
  `sync_engine_mutations` row marked acked without a server
  `mutations_applied` row.

**Heal of MQTT must not be required** for the Always. Heal of HTTP +
foreground is required. Backgrounded clients skip the 30s tick — the
workload must foreground or call `wakeAll`.

Do not reuse sim `chaos.partition` as the oracle: that mesh is undirected
and skipped at max fidelity. Antithesis should cut TCP/TLS to EMQX:1883/WSS
independently of the API port.

## Existing assertions

DST: `push-seq-monotonic-per-topic` (`pkgs/sync-engine/src/sim/invariants.ts`).
**Missing** as Antithesis SDK: all of the above. No SUT probe today that
HTTP succeeded while MQTT failed.

## Key observations

- Three sequences must not be conflated: scope checkpoint, topic
  `pushSeq`, client mutation `seq`.
- Missing EMQX secrets: HTTP pubsub `get()` undefined → silent no-op while
  `status()` can report `'connected'` (`sut-analysis` A16). A “MQTT up”
  signal from the wrapper is not broker reachability.
- `publish()` `waitUntilConnected` has no timeout — HTTP upload can finish
  while publish hangs.
- Cold start: cannot subscribe until `client_config` hydrates over HTTP.

## Open questions

- None

## Synthesis merge (orchestrator)

Also covers: `mqtt-accept-not-deliver`. Publish resolve ≠ delivery; `pushSeq` gaps must refetch; HTTP is the truth path. EMQX 600s session expiry is a Sometimes condition under this property.

### Investigation Log

#### After a pushSeq gap, does commitPendingPushSeqs floor last_push_seq past a hole?

- Examined: `attach-push-handle.ts` `wakeRefetch` / `commitPendingPushSeqs`; `attach-push.ts` `setAfterSweep`; `subscription-runtime.ts` `flushPending` (afterSweep after `runSubscriptionSweep`); `subscription-runtime-sweep.ts` `handleSweepResponse` (`ok` / `not_modified` / `denied`, generation skip).
- Found: afterSweep is invoked with the **swept scope list**, not “successfully merged” scopes. `not_modified` without hash drift, `denied`, and generation-mismatch all skip `applyFullMerge` but still count as overlap for `recordPushApplied`. Pending map stores the latest seq per topic (a later gapped message overwrites).
- Not found: a guard that `applyFullMerge` or heal ran for every overlapping scope before flooring.
- Conclusion: resolved — yes, flooring past a hole is a real source path. Property **changed**: Always is domain-vs-server after HTTP heal; add Reachable for commit-pending-without-full-merge. SDK **missing**.

#### Is QoS1 + 600s session relied on as eventually delivered?

- Examined: `pkgs/pubsub/README.md`, `pkgs/pubsub/src/interface.ts`, `pkgs/pubsub-emqx/README.md`, `create-emqx-pubsub.ts` (`EMQX_SESSION_EXPIRY_SEC = 600`), `attach-push.ts` remake comment, `sut-analysis.md` A16 / MQTT notes. Scope was this tree only.
- Found: in-tree wording is “best-effort live push” and “short broker offline session queue,” not at-least-once / offset replay. QoS1 + 600s is a reconnect drain, not a truth path. `close()` sets expiry 0.
- Not found: a product comment that MQTT delivery is required for correctness.
- Conclusion: resolved — treat MQTT as best-effort. Property unchanged on this point.

#### Is the 30s reconcile paused while backgrounded?

- Examined: `subscription-runtime.ts` `startReconcileTick`, `onLifecycle('background'|'foreground')`, `flushPending` (`!this.foregrounded` returns without sweep).
- Found: background clears the reconcile interval and skips flush/wake. Foreground restarts the tick and `wakeAll`.
- Not found: a background path that still ticks.
- Conclusion: resolved — yes. Workload must foreground or `wakeAll`. Catalog question dropped.
