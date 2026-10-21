# `@pkgs/pubsub-root-shared-ts`

Application-agnostic **topic pub/sub port**. One interface (`PubSub`) for every adapter (in-memory tests, EMQX MQTT/HTTP, future Durable Objects). Zero app knowledge — no imports from `libs/*`, sync-engine, mutations, or queries.

## Semantics contract

- **Best-effort live push**: delivery to currently-connected subscribers. Adapters may drain a **short** broker offline session queue on reconnect (QoS ≥ 1 + persistent session) — not a full event stream / offset replay. No retained messages, no receipts, no cross-topic ordering.
- **Payloads**: opaque JSON-serializable values, ≤32KB serialized, moved through shared `encodePayload` / `decodePayload`. Malformed inbound frames are dropped with a warn, never thrown.
- **Topics**: `/^[a-z0-9_-]+(:[A-Za-z0-9_-]+)*$/`, ≤128 chars. **No wildcards** in the port API (`+`, `#`, `*`) and no `/` — MQTT hierarchy/wildcards are rejected so every adapter (including future DO) can implement the same topic space.

Topic names are the consumer's; over-nudging is fine, under-nudging is a
latency bug, not a correctness bug.

- Consumers own repair. `onStatus` signals transport health; when a session expired or the offline queue overflowed, domain sync (not this port) is the catch-up path.
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
| `@pkgs/pubsub-root-shared-ts/interface` | `PubSub`, errors, `assertValidTopic`, codec      |
| `@pkgs/pubsub-root-shared-ts/in-memory`   | `createInMemoryPubSub` (runtime; no bun:test)    |
| `@pkgs/pubsub-root-shared-ts/in-memory/contract` | `runPubSubContractTests` (adapter contract) |

## How to implement an adapter

1. Implement `PubSub` using **only** port helpers for topics/payloads (`assertValidTopic`, `encodePayload`, `decodePayload`).
2. Pass the contract suite:

```ts
import { wallClock, wallTimers } from '@pkgs/clock';
import { runPubSubContractTests } from '@pkgs/pubsub-root-shared-ts/in-memory/contract';

runPubSubContractTests('my-adapter', async () => ({
  make: async () => createMyFullDuplex(),
  makePublishOnly: async () => createMyPublishOnly(), // optional
  disruptTransport: async (p) => {
    /* force disconnect so status + resubscribe are exercised */
  },
  injectMalformedInbound: async (p, topic) => {
    /* deliver a non-JSON frame onto the decode path */
  },
  clock: wallClock,
  timers: wallTimers,
  teardown: async () => {
    /* dispose shared resources */
  },
}));
```

3. Full-duplex adapters own reconnect. Prefer a stable client id + short broker session so offline messages can drain; still re-SUBSCRIBE the desired topic set so app and broker stay aligned. Domain sync remains the repair backstop.
4. Never issue wildcard subscriptions, even internally.

See `@pkgs/pubsub-emqx` for a reference adapter.
