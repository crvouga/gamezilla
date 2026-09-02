# emqx-publish-wait-until-connected-settles

Focus: Resource Boundaries. Confidence: **high**.

## Why this property

Client MQTT `publish()` awaits `waitUntilConnected()` with **no timeout**.
Waiters are stored in an unbounded `Set` and are flushed only on broker
`connect` or adapter `close()` — not on `offline` / socket `close`. A
publish started while the socket is down (or races to down after
`status() === 'connected'`) becomes a promise that never settles until
reconnect or process teardown.

That is an unbounded waiter / in-flight-promise leak under partition, plus
a liveness hole for every caller that `await`s publish.

`existing-assertions.md`: no Antithesis SDK. Suggested assertions are
**missing**.

## Code paths

**Client MQTT (the named hole)**

- `pkgs/pubsub-emqx/src/create-emqx-pubsub.ts`
  - `publish` (83–89): `assertOpen` → `waitUntilConnected()` →
    `requireClient()` → QoS1 publish. No `AbortSignal`, no deadline.
  - `waitUntilConnected` (260–270): if `this.client?.connected`, resolve;
    else push `finish` into `connectWaiters` with no timer.
  - `flushConnectWaiters` (273–276): invoked from `close()` (134) and
    `client.on('connect')` (183).
  - `client.on('close')` (185–188): `setStatus('down')` +
    `scheduleReconnect()` — **does not** flush waiters.
  - `client.on('offline')` (190–193): `setStatus('down')` — **does not**
    flush waiters.
  - Reconnect: full jitter, base 500ms, max 30s (73–74, 222–239). Waiters
    stay until a later `connect` or `close()`.

**Who awaits publish**

- Optimistic fanout: `publishItems` `Promise.all` of `pubsub.publish`
  (`optimistic-fanout.ts` 117–127). `notifyLocalMutation` fires this when
  `status() === 'connected'` (`create-local-sync-engine.ts` 303–306). Race:
  status connected → later `waitUntilConnected` sees `!client.connected` →
  waiter added. Connected fast path does **not** use the 256 outbound
  buffer.
- Server fanout: `notifyChannels` / `publishPushMessages`
  (`pkgs/sync-engine/src/server/notify-channels.ts` 29–35, 93–95) is
  fire-and-forget `void pubsub.publish(...).catch(...)`. Production server
  uses HTTP publish, not this MQTT waiter (below).

**Server HTTP publish (related, no timeout either)**

- `pkgs/pubsub-emqx/src/create-emqx-http-pubsub.ts` `publish` (38–63):
  `fetch` to `POST /api/v5/publish` with **no** `signal` / timeout.
  `status()` is `'connected'` whenever the adapter is not closed (72–73),
  including when EMQX secrets are missing / broker is down (SUT analysis
  A16). Hung fetch = leaked promise per allocated `pushSeq`.

## Claimed vs desired bound

Docs/comments: `publish` resolve means accepted, not delivered
(`sut-analysis.md` safety). There is **no** claimed settle deadline. The
property under test is a resource bound Antithesis should hold: an
in-flight `publish()` either fulfills, rejects (`PubSubClosedError` /
`PubSubPublishError`), or the adapter is closed — and
`connectWaiters.size` does not grow without bound while the broker is
partitioned.

## Failure if violated

- Offline mutate / reconnect storms accumulate `connectWaiters` and
  `Promise.all` fanout promises on the client.
- Server HTTP path: one hung `fetch` per topic after `allocateTopicPushSeqs`
  — isolate memory, and a permanent `pushSeq` gap if the process dies
  (allocate-then-drop; separate integrity property).
- `close()` does flush MQTT waiters (reject). Tab hang without `close()`
  does not.

## Antithesis angle

Asymmetric partition of MQTT WSS after `status()` has been `connected`.
Keep mutating (optimistic publish) and/or applying server mutations
(HTTP publish). Count outstanding waiters / fetches. Wall-clock jump vs
30s keepalive / 600s session expiry (`EMQX_SESSION_EXPIRY_SEC`).

## Suggested instrumentation (all missing)

- SUT-side `Always(connectWaiters.size <= N, "emqx mqtt publish waiters bounded")`
  after each `connectWaiters.add` (pick N from in-flight publish concurrency;
  even N=64 would catch a storm).
- SUT-side `Always` / timer: each `waitUntilConnected` promise settles
  within a deadline or `close()` ran.
- `Reachable("emqx waitUntilConnected parked while status down")`.
- `Unreachable` only if the team decides hung publish is a defect class
  that must never persist across a quiet period — today the code allows it.
- HTTP adapter: `Always` that `fetch` to `/api/v5/publish` is started with
  a deadline, or workload counts in-flight publishes after notify.

## Open questions

- What settle bound is acceptable — reconnect `maxMs` (30s), session
  expiry (600s), or a new publish timeout? The invariant wording stays
  “settles”; the number is parametric until chosen.

- Does product optimistic fanout use the MQTT adapter (`createEmqxPubSub`)
  on the same client that mutates? If optimistic publish is disabled
  (`rowImageFanout` / `bufferOutboundLive` defaults), the client waiter
  leak is mostly unused and the HTTP server path is the one to instrument.

- Should HTTP publish (no `waitUntilConnected`) be a sibling property or
  the same one? Same missing-deadline class, different process and API.
