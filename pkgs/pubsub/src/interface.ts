import type { Topic } from './topic';

export { decodePayload, encodePayload, PAYLOAD_MAX_BYTES } from './payload';
export { PubSubClosedError } from './pubsub-closed-error';
export { PubSubNotSupportedError } from './pubsub-not-supported-error';
export { PubSubPublishError } from './pubsub-publish-error';
export type { Topic } from './topic';
export { assertValidTopic } from './topic';

export type PubSubStatus = 'connected' | 'connecting' | 'down';

/**
 * Topic pub/sub port — ONE interface for every adapter (full-duplex MQTT,
 * publish-only HTTP, future Durable Objects, in-memory tests).
 *
 * Semantics (best-effort live push):
 * - Delivery to currently-connected subscribers; adapters may also drain a
 *   short broker offline session queue on reconnect (QoS ≥ 1 + persistent
 *   session). Not a full event stream / offset replay.
 * - No retained messages, no cross-topic ordering, no delivery receipts.
 * - Payloads: opaque JSON-serializable values, ≤32KB serialized, via shared
 *   `encodePayload` / `decodePayload`. Malformed inbound frames are dropped
 *   with a warn, never thrown.
 * - Topics: `/^[a-z0-9_-]+(:[A-Za-z0-9_-]+)*$/`, ≤128 chars. No wildcards
 *   (`+`, `#`, `*`) and no `/` in the port API.
 * - Consumers own repair. `onStatus` signals transport health; the port does
 *   not poll or guarantee catch-up when the session expired or the queue
 *   overflowed — domain sync remains the source of truth.
 *
 * `publish` is fire-and-forget safe: resolving means ACCEPTED by the
 * transport, never DELIVERED.
 *
 * `subscribe` is refcounted: N handlers on one topic = one transport
 * subscription. Handler errors are contained, never thrown upward.
 *
 * Publish-only instances (stateless HTTP): `subscribe` throws
 * {@link PubSubNotSupportedError}; `status` is always `'connected'`;
 * `onStatus` never fires.
 *
 * After {@link PubSub.close}: further `publish` / `subscribe` throw;
 * `status` is `'down'`; `onStatus` never fires; `close` is idempotent.
 * An instance subscribed to a topic receives its own publishes (self-delivery).
 */
export interface PubSub {
  publish(topic: Topic, data: unknown): Promise<void>;
  subscribe(topic: Topic, handler: (data: unknown) => void): () => void;
  status(): PubSubStatus;
  onStatus(cb: (s: PubSubStatus) => void): () => void;
  close(): void;
}
