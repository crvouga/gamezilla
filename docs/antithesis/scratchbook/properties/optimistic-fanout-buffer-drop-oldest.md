# optimistic-fanout-buffer-drop-oldest

Focus: Resource Boundaries. Confidence: **high**.

## Why this property

Optimistic MQTT fanout is an in-memory reconnect queue, not a durable log. The
code claims a Tiger bound of 256 and drop-oldest overflow. That is a concrete
capacity / backpressure contract: the queue must not grow with mutate rate
while the broker is down, and overflow is lossy by design (snapshots +
reconcile are the repair path).

`existing-assertions.md`: no Antithesis SDK. Suggested assertions below are
**missing**.

## Code paths

- `pkgs/sync-engine/src/client/optimistic-fanout.ts`
  - `MAX_OUTBOUND_LIVE = 256` (line 16)
  - `createOutboundLiveBuffer().enqueue` pushes then
    `while (queue.length > MAX_OUTBOUND_LIVE) queue.shift()` (lines 157–161)
  - `flush` splices the whole queue and `Promise.all` publishes (lines 163–166,
    `publishItems` 117–127)
- `pkgs/sync-engine/src/client/create-local-sync-engine.ts`
  - Buffer created only when `bufferOutbound` is true (line 261)
  - `notifyLocalMutation`: if pubsub `status() === 'connected'`, publish
    immediately (no buffer); else `buildOptimisticFanout` → `enqueue` (287–316)
- `pkgs/sync-engine/src/client/attach-configured-push.ts`
  - `bufferOutboundLive` default **false**; when true, flush on attach (27–31,
    58–62)
- Sibling 256 drop-oldest queues (same resource class, not this invariant):
  - `pkgs/pubsub/src/testing/in-memory.ts` `IN_MEMORY_PUBSUB_MAX_BUFFER = 256`
  - `pkgs/sync-engine/src/sim/pubsub-bridge-resend.ts` `MAX_RESEND_BUFFER = 256`
  - `pkgs/room/src/bounds.ts` `MAX_PENDING_OUTBOUND_COMMANDS = 256`

## Claimed bound

While pubsub is detached / not `connected`, queued optimistic publishes stay
≤ 256. The 257th enqueue drops the oldest item. Peers may miss those images;
that is allowed. Domain truth is upload + snapshot / 30s reconcile.

The bound does **not** apply to the connected fast path: each local mutate
fires `publishOptimisticFanout` immediately. That path can pile in-flight
`publish()` promises if MQTT `waitUntilConnected` hangs (see
`emqx-publish-wait-until-connected-settles`).

## Failure if violated

- Unbounded `OutboundLiveItem[]` while MQTT is down → client heap growth
  under offline mutate storms.
- If drop-oldest is skipped or the cap is ignored, the “lossy hint” queue
  becomes an unbounded buffer.
- If drop-oldest runs but a later flush republishes dropped-and-rebuilt
  items out of order, that is a protocol issue (not this property).

## Antithesis angle

Pause / partition the MQTT client, keep the origin up, mutate faster than
reconnect. Assert queue depth after every enqueue. `Reachable` the
`queue.shift()` overflow branch — it is the interesting capacity path.

## Suggested instrumentation (all missing)

- SUT-side `Always(queue.length <= 256, "optimistic outbound-live queue bounded")`
  at the end of `enqueue`.
- SUT-side `Reachable("optimistic outbound-live drop-oldest")` inside the
  `while (queue.length > MAX_OUTBOUND_LIVE)` body.
- Workload: after a down-period mutate burst, queue length ≤ 256 and domain
  rows still converge via HTTP snapshot (lossy fanout must not become the
  truth path).

## Open questions

- Is `bufferOutboundLive` enabled on the product web client, or only
  in sim? If product default is false, the 256 queue is unused in production
  and the connected fire-and-forget path is the real leak surface. That would
  narrow this property to sim/web-lock owners that opt in, and raise the
  priority of the EMQX waiter property.

- Does `flush` + mid-flush disconnect re-enqueue leftover items, or are they
  dropped from memory after `splice`? If dropped, overflow is not the only
  loss path; the invariant stays “≤ 256” but liveness of those hints is
  weaker.

- Should the in-memory pubsub 256 mqueue and room outbound 256 share a
  portfolio bound, or stay separate properties? Same number, different
  processes.
