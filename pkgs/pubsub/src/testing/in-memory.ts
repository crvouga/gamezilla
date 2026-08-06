import { PubSubClosedError } from '../pubsub-closed-error';
import type { PubSub, PubSubStatus } from '../interface';
import { decodePayload, encodePayload } from '../payload';
import { assertValidTopic, type Topic } from '../topic';

type Handler = (data: unknown) => void;

/** Shared wire for multi-instance in-memory contract tests. */
export type InMemoryBus = {
  publish(topic: Topic, encoded: string, source: InMemoryPubSub): void;
  register(instance: InMemoryPubSub): void;
  unregister(instance: InMemoryPubSub): void;
};

export function createInMemoryBus(): InMemoryBus {
  const instances = new Set<InMemoryPubSub>();
  return {
    register(instance) {
      instances.add(instance);
    },
    unregister(instance) {
      instances.delete(instance);
    },
    publish(topic, encoded, source) {
      for (const instance of instances) {
        instance.receiveEncoded(topic, encoded, source);
      }
    },
  };
}

export class InMemoryPubSub implements PubSub {
  private readonly handlers = new Map<Topic, Set<Handler>>();
  private readonly statusListeners = new Set<(s: PubSubStatus) => void>();
  private closed = false;
  private readonly bus: InMemoryBus;

  constructor(bus?: InMemoryBus) {
    this.bus = bus ?? createInMemoryBus();
    this.bus.register(this);
  }

  async publish(topic: Topic, data: unknown): Promise<void> {
    this.assertOpen();
    assertValidTopic(topic);
    const encoded = encodePayload(data);
    this.bus.publish(topic, encoded, this);
  }

  subscribe(topic: Topic, handler: Handler): () => void {
    this.assertOpen();
    assertValidTopic(topic);
    let set = this.handlers.get(topic);
    if (!set) {
      set = new Set();
      this.handlers.set(topic, set);
    }
    set.add(handler);
    return () => {
      const current = this.handlers.get(topic);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) this.handlers.delete(topic);
    };
  }

  status(): PubSubStatus {
    return this.closed ? 'down' : 'connected';
  }

  onStatus(cb: (s: PubSubStatus) => void): () => void {
    if (this.closed) return () => undefined;
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.handlers.clear();
    this.statusListeners.clear();
    this.bus.unregister(this);
  }

  /** Test hook: deliver a raw wire frame through decodePayload. */
  deliverRawForTest(topic: Topic, raw: string): void {
    this.assertOpen();
    assertValidTopic(topic);
    this.dispatchDecoded(topic, decodePayload(raw));
  }

  receiveEncoded(topic: Topic, encoded: string, _source: InMemoryPubSub): void {
    if (this.closed) return;
    this.dispatchDecoded(topic, decodePayload(encoded));
  }

  private dispatchDecoded(topic: Topic, data: unknown): void {
    if (data === undefined) return;
    const set = this.handlers.get(topic);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(data);
      } catch (err) {
        console.warn('[pubsub] handler error contained', err);
      }
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new PubSubClosedError();
  }
}

export function createInMemoryPubSub(bus?: InMemoryBus): PubSub {
  return new InMemoryPubSub(bus);
}
