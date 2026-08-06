# `@pkgs/pubsub`

Application-agnostic **topic pub/sub port**. One interface (`PubSub`) for every adapter (in-memory tests, EMQX MQTT/HTTP, future Durable Objects). Zero app knowledge — no imports from `libs/*`, sync-engine, mutations, or queries.

## Semantics contract

- **QoS 0 / best-effort**: at-most-once delivery to currently-connected subscribers. No persistence, no retained messages, no replay, no offline queues, no receipts, no cross-topic ordering.
- **Payloads**: opaque JSON-serializable values, ≤32KB serialized, moved through shared `encodePayload` / `decodePayload`. Malformed inbound frames are dropped with a warn, never thrown.
- **Topics**: `/^[a-z0-9_-]+(:[A-Za-z0-9_-]+)*$/`, ≤128 chars. **No wildcards** in the port API (`+`, `#`, `*`) and no `/` — MQTT hierarchy/wildcards are rejected so every adapter (including future DO) can implement the same topic space.

### Product topic helpers (Gamezilla)

Entity-scoped, coarse names for the sync nudge layer live in
`@libs/db/shared/sync-topics` (`userTopic`, `roomTopic`, `userChannels`,
`spaceListChannels`) — not in `@pkgs/sync-engine` or this package:

- `user:{actorId}` — actor-scoped boot / membership list invalidation
- `room:{spaceId}` — space/room membership invalidation (product entity is a space)

Over-nudging is fine (`not_modified` absorbs it). Under-nudging is a latency bug, not a correctness bug. Topics are produced only from `defineQuery.channels` / `defineMutation.invalidates` and validated at registry construction.

- Consumers own repair. `onStatus` signals transport health; the port does not poll, buffer, or retry-deliver.
- **`publish`** resolving means **ACCEPTED** by the transport, never DELIVERED.
- **Self-delivery**: an instance subscribed to a topic receives its own publishes.
- **`close()`** is terminal and idempotent. After close: `publish` / `subscribe` throw; `status()` is `'down'`; `onStatus` never fires.

## Publish-only instances

Stateless environments (e.g. Cloudflare Workers HTTP → EMQX) return the **same** `PubSub` type with degenerate capabilities:

- `subscribe()` throws `PubSubNotSupportedError` immediately (programming error — fail loud).
- `status()` returns `'connected'` while open (HTTP is connectionless); `onStatus` never fires.
- `publish`, topic validation, and payload rules match full-duplex instances.

## Package surface

| Import                   | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `@pkgs/pubsub/interface` | `PubSub`, errors, `assertValidTopic`, codec      |
| `@pkgs/pubsub/testing`   | `createInMemoryPubSub`, `runPubSubContractTests` |

## How to implement an adapter

1. Implement `PubSub` using **only** port helpers for topics/payloads (`assertValidTopic`, `encodePayload`, `decodePayload`).
2. Pass the contract suite:

```ts
import { runPubSubContractTests } from '@pkgs/pubsub/testing';

runPubSubContractTests('my-adapter', async () => ({
  make: async () => createMyFullDuplex(),
  makePublishOnly: async () => createMyPublishOnly(), // optional
  disruptTransport: async (p) => {
    /* force disconnect so status + resubscribe are exercised */
  },
  injectMalformedInbound: async (p, topic) => {
    /* deliver a non-JSON frame onto the decode path */
  },
  teardown: async () => {
    /* dispose shared resources */
  },
}));
```

3. Full-duplex adapters own reconnect + re-SUBSCRIBE of the desired topic set (`clean` session — no broker session reliance).
4. Never issue wildcard subscriptions, even internally.

See `@pkgs/pubsub-emqx` for a reference adapter.
