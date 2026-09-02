# outbox-processed-without-notify

Focus: Failure Recovery. Confidence: high.

## Claim to test (not a fact)

An outbox delivery that is marked `processed_at` without a successful `notifyChannels` must not leave recipients permanently stale. Domain rows written by the consumer (e.g. `notifications`) are in Postgres; peers must still observe them via snapshot / 30s reconcile. The delivery must not be retried (processed is terminal), so MQTT fanout is **not** the durability path.

Cron drain is the production sweeper that makes this window likely: it opens its own DB session and **never** enters `apiRequestAsyncLocalStorage`. `drainAndNotifyOutbox` then returns after `drainOutbox` with `store === undefined`, skipping publish.

## Why this property

SUT analysis: “Outbox processed, notify skipped (cron/ALS/pubsub miss).” Concurrency: `claimDueDeliveries` is SELECT without `FOR UPDATE` / `SKIP LOCKED`; comment says “single Worker drain.” Cron + post-`/mutations` drain + notification REST can overlap. `notifyChannels` allocates `pushSeq` then fire-and-forget; failures are not retried.

In-tree pin `oob-empty-hydrate-heals-via-reconcile-tick.sim.test.ts` is the intended repair for missed notify — sim interval 500ms, product 30s, and sweeps claim to pause while backgrounded.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Failure scenario

1. Friend-request (or other) mutation commits; outbox event + delivery rows exist.
2. Cron `scheduled` → `drainOutboxOnCron` → `drainAndNotifyOutbox` with no ALS store.
3. `drainOutbox` runs handlers in a txn, `markProcessed`, collects `notifyUserIds` from consumers (`toUserId` / `fromUserId`).
4. `drainAndNotifyOutbox`: `notifyUserIds.length > 0` but `apiRequestAsyncLocalStorage.getStore()` is `undefined` → **return `processed`**. No `notifyChannels`. Same skip if `HttpPubSubFromSecretStore.get()` is `undefined` (missing EMQX secrets: wrapper can still report `connected`).
5. Recipients have new `notifications` rows on the server and no MQTT push. Foreground reconcile (30s) or next `/query` should hydrate. Backgrounded clients claim not to sweep.

Partial-failure variant: ALS is present, `allocateTopicPushSeqs` commits, process dies before `publish` — permanent `pushSeq` gap; contiguous-push clients wait for refetch. Same user-visible miss, different subphase.

Double-claim variant (recovery assuming exclusive drain): two isolates SELECT the same due rows; both run the handler; both `markProcessed`. Handler must be idempotent. Notify may fire twice or not at all.

## Code paths

| Path | Role |
|---|---|
| `pkgs/outbox/src/drain.ts` `claimDueDeliveries` | Portable SELECT of due rows; no lock. Comment: “single Worker drain.” |
| same file `markProcessed` / `runDelivery` | Success → `processed_at` set in the same txn as the handler. |
| `apps/server/src/sync/outbox-drain.ts` `drainAndNotifyOutbox` | After drain: no ALS → return; no pubsub → return; else `notifyChannels` on `notifications` / user topics. |
| `apps/server/src/server.ts` `drainOutboxOnCron` / `scheduled` | Own `openRequestDb`; no `apiRequestAsyncLocalStorage.run`. |
| `apps/server/src/app/create-server.ts` | Post-success `POST …/mutations` drains on the request SQL **with** ALS (the path that *can* notify). |
| `libs/friends/src/root/server/friends-outbox-consumers.ts` | Handlers return `notifyUserIds`. |
| `pkgs/sync-engine/src/server/notify-channels.ts` | Allocate then fire-and-forget publish; errors logged, not retried. |
| `pkgs/sync-engine/src/client/subscription-constants.ts` | `QUERY_RECONCILE_INTERVAL_MS = 30_000`; sim 500ms. |
| `pkgs/sync-engine/src/tests/scenarios/oob-empty-hydrate-heals-via-reconcile-tick.sim.test.ts` | Missed notify heals via tick (no nudge). |

## What goes wrong if violated

Friend-request / accept notifications never appear until the user foregrounds and waits 30s — or never, if reconcile is disabled / background-paused and the next explicit hydrate does not include `notifications`. If a client treats missing push as “no data,” inbox stays empty while the server row exists (confirmed-success on the sender, silence on the recipient). Exhausted deliveries park `available_at` + 365d — a *failed* handler is a different silent hole; this property is the **successful process + skipped notify** hole.

## SUT instrumentation (all missing)

Recovery / notify **subphases**:

- `Reachable` — `drainOutbox` processed > 0 and ALS store missing (`outbox.drain.processed_no_als`).
- `Reachable` — processed > 0 and `pubsub === undefined` (`outbox.drain.processed_no_pubsub`).
- `Reachable` — `notifyChannels` allocated seqs then publish threw/logged (`outbox.notify.allocate_then_drop`).
- `Reachable` — two drains claimed the same `(event_id, consumer_id)` (`outbox.drain.double_claim`).
- `Reachable` — consumer handler ok + `markProcessed` (`outbox.delivery.processed`).

Safety / liveness:

- `Always` — a `processed_at` delivery’s handler side effects appear at most once (idempotent consumer).
- `Always` — after process-without-notify, server snapshot for the recipient topic eventually contains the notification row (workload check after a quiet period ≥ reconcile interval, and after foreground).
- `Sometimes(cond)` — process-without-notify **and** a later query hydrate observed the row with no intervening MQTT (`outbox.heal_via_reconcile`).
- `Unreachable` — recipient local DB permanently missing a server notification row after a foreground reconcile window.

Do not assert “notify always fires on cron” — the code’s claimed contract is snapshot/reconcile repair, not at-least-once MQTT.

## Open questions

- None

## Related

- `health-ok-db-down-opens-gate` — health-ok + EMQX-down is notify skipped because `get()` is undefined while status is `connected`.
- `crash-after-apply-before-ack` — mutation apply can succeed and still miss fanout; outbox is the inbox-action sibling of that allocate-then-drop pattern.

### Investigation Log

#### In production, does Cloudflare invoke `scheduled` on an isolate that also has in-flight `/mutations` drains?

- Examined: `apps/server/src/server.ts` `scheduled` / `drainOutboxOnCron`; `create-server.ts` post-mutations drain; `wrangler.toml` `crons`; `claimDueDeliveries`; ALS usage in `drainAndNotifyOutbox`.
- Found: cron always opens its own DB session and never enters `apiRequestAsyncLocalStorage`, so ALS-skip notify is unconditional on cron. Double-claim does not require same-isolate co-location — cron isolate and request isolate share Neon and the unlocked SELECT.
- Not found: in-repo documentation of whether CF co-locates `scheduled` and `fetch` on one isolate. Not needed: the race is at Postgres.
- Conclusion: resolved — ALS-skip is the cron bug regardless. Double-claim is possible across isolates. Property unchanged.

#### Is `notifications` in the recipient’s session query set so reconcile actually fetches it?

- Examined: `apps/client/src/sync/create-local-sync-engine.ts` `SESSION_QUERIES`; `notificationsActive` / `NOTIFICATIONS_QUERIES`; `libs/runtime/src/root/app-queries.ts`.
- Found: `notificationsActive` is in the engine-lifetime session list with `mySpaces` / `friendships`. Reconcile / `/api/query` includes it.
- Not found: a product path that omits notifications from the live query set.
- Conclusion: resolved — missed MQTT is recoverable via snapshot/reconcile. `Unreachable` “permanently missing after foreground reconcile” is checkable.

#### Do backgrounded clients pause the 30s tick as claimed?

- Examined: `pkgs/sync-engine/src/client/subscription-runtime.ts` `onLifecycle`; `app-lifecycle.ts`; `QUERY_RECONCILE_INTERVAL_MS`.
- Found: `background` sets `foregrounded = false` and `clearReconcileTick()`. `startReconcileTick` no-ops unless `foregrounded`. `foreground` restarts the tick and `wakeAll()`.
- Not found: a background path that still sweeps queries.
- Conclusion: resolved — “eventually” is foreground-gated. Property already says “after a foreground reconcile window”; keep that wording.

#### After `allocate` then drop, does the contiguous `pushSeq` check block later live pushes until refetch?

- Examined: `attach-push-handle.ts` `tryApplyFanoutRows` / `isContiguousNext` / `wakeRefetch`; `push-seq-gap-forces-refetch-not-image-apply.sim.test.ts`.
- Found: a gap fails `isContiguousNext` → fanout apply returns false → `wakeRefetch`. Later live pushes are not parked; they skip image-apply and wake HTTP refetch. Client `last_push_seq` does not advance on a dropped publish.
- Not found: a contiguous-seq wait that blocks the MQTT handler until the missing seq arrives.
- Conclusion: resolved — allocate-then-drop skips the gap message’s row images and refetches; it does not stall later pushes.

SDK (`existing-assertions.md`): **missing**. All suggested Reachable / Always / Sometimes / Unreachable are new.
