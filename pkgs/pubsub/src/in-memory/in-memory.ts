import type { Logger } from '@pkgs/logger';
import type { PubSub, PubSubStatus } from '../interface';
import { decodePayload, encodePayload } from '../payload';
import { PubSubClosedError } from '../pubsub-closed-error';
import { PubSubNotSupportedError } from '../pubsub-not-supported-error';
import { assertValidTopic, type Topic } from '../topic';

type Handler = (data: unknown) => void;

/** Default offline session queue depth (EMQX-like mqueue bound). */
export const IN_MEMORY_PUBSUB_MAX_BUFFER = 256;

/** Shared wire for multi-instance in-memory pubsub (sims + contract tests). */
export type InMemoryBus = {
  publish(topic: Topic, encoded: string, source: InMemoryPubSub): void;
  register(instance: InMemoryPubSub): void;
  unregister(instance: InMemoryPubSub): void;
  /** Live peer instances registered on this bus. */
  listInstances(): readonly InMemoryPubSub[];
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
    listInstances() {
      return [...instances];
    },
  };
}

export type InMemoryPubSubOptions = {
  readonly bus?: InMemoryBus;
  /**
   * When true (default), buffer publishes while status is `down` for topics
   * with active subscriptions, and flush on reconnect to `connected`.
   */
  readonly offlineBuffer?: boolean;
  /** Cap buffered messages (oldest dropped). Default {@link IN_MEMORY_PUBSUB_MAX_BUFFER}. */
  readonly maxBuffer?: number;
  /** Receives dropped-frame and contained-handler-error warnings. */
  readonly logger: Logger;
};

type BufferedMessage = {
  readonly topic: Topic;
  readonly data: unknown;
};

export class InMemoryPubSub implements PubSub {
  private readonly handlers = new Map<Topic, Set<Handler>>();
  private readonly statusListeners = new Set<(s: PubSubStatus) => void>();
  private closed = false;
  private forcedStatus: PubSubStatus | null = null;
  private readonly bus: InMemoryBus;
  private readonly offlineBuffer: boolean;
  private readonly maxBuffer: number;
  private readonly buffer: BufferedMessage[] = [];
  private readonly logger: Logger;

  constructor(options: InMemoryPubSubOptions) {
    this.logger = options.logger;
    this.bus = options.bus ?? createInMemoryBus();
    this.offlineBuffer = options.offlineBuffer !== false;
    this.maxBuffer = options.maxBuffer ?? IN_MEMORY_PUBSUB_MAX_BUFFER;
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
    this.flushBufferedTopic(topic, handler);
    return () => {
      const current = this.handlers.get(topic);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) this.handlers.delete(topic);
    };
  }

  status(): PubSubStatus {
    if (this.closed) return 'down';
    return this.forcedStatus ?? 'connected';
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
    this.buffer.length = 0;
    this.bus.unregister(this);
  }

  /** Test hook: deliver a raw wire frame through decodePayload. */
  deliverRawForTest(topic: Topic, raw: string): void {
    this.assertOpen();
    assertValidTopic(topic);
    this.dispatchDecoded(topic, decodePayload(raw, this.logger));
  }

  /** Test hook: force status transitions without closing. */
  setStatusForTest(status: PubSubStatus): void {
    if (this.closed) return;
    const prev = this.status();
    this.forcedStatus = status;
    for (const cb of [...this.statusListeners]) {
      try {
        cb(status);
      } catch (err) {
        this.logger.warn('status listener error contained', {
          error: String(err),
        });
      }
    }
    if (prev === 'down' && status === 'connected') {
      this.flushAllBuffered();
    }
  }

  /** Test hook: topics with at least one handler. */
  subscribedTopicsForTest(): readonly Topic[] {
    return [...this.handlers.keys()];
  }

  /** Test / product-simulator hook: subscriber counts per topic. */
  topicStatsForTest(): readonly {
    readonly topic: Topic;
    readonly subscriberCount: number;
  }[] {
    return [...this.handlers.entries()].map(([topic, set]) => ({
      topic,
      subscriberCount: set.size,
    }));
  }

  /** Test hook: pending offline buffer depth. */
  bufferedCountForTest(): number {
    return this.buffer.length;
  }

  receiveEncoded(topic: Topic, encoded: string, _source: InMemoryPubSub): void {
    if (this.closed) return;
    const data = decodePayload(encoded, this.logger);
    if (data === undefined) return;
    if (this.offlineBuffer && this.status() === 'down') {
      if (this.handlers.has(topic)) {
        this.enqueue(topic, data);
      }
      return;
    }
    this.dispatchDecoded(topic, data);
  }

  private enqueue(topic: Topic, data: unknown): void {
    this.buffer.push({ topic, data });
    while (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
  }

  private flushAllBuffered(): void {
    const pending = this.buffer.splice(0, this.buffer.length);
    for (const msg of pending) {
      this.dispatchDecoded(msg.topic, msg.data);
    }
  }

  private flushBufferedTopic(topic: Topic, handler: Handler): void {
    if (!this.offlineBuffer || this.status() === 'down') return;
    const keep: BufferedMessage[] = [];
    for (const msg of this.buffer) {
      if (msg.topic !== topic) {
        keep.push(msg);
        continue;
      }
      try {
        handler(msg.data);
      } catch (err) {
        this.logger.warn('handler error contained', { error: String(err) });
      }
    }
    this.buffer.length = 0;
    this.buffer.push(...keep);
  }

  private dispatchDecoded(topic: Topic, data: unknown): void {
    if (data === undefined) return;
    const set = this.handlers.get(topic);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(data);
      } catch (err) {
        this.logger.warn('handler error contained', { error: String(err) });
      }
    }
  }

  private assertOpen(): void {
    if (this.closed) throw new PubSubClosedError();
  }
}

export function createInMemoryPubSub(options: InMemoryPubSubOptions): PubSub {
  return new InMemoryPubSub(options);
}

/**
 * Publish-only peer on a shared bus (API notifyChannels). Subscribe throws.
 */
export function createInMemoryPublishOnlyPubSub(options: {
  readonly bus: InMemoryBus;
  readonly logger: Logger;
}): PubSub {
  const duplex = new InMemoryPubSub({ ...options, offlineBuffer: false });
  return {
    publish: (topic, data) => duplex.publish(topic, data),
    subscribe: () => {
      throw new PubSubNotSupportedError('in-memory publish-only');
    },
    status: () => 'connected',
    onStatus: () => () => undefined,
    close: () => {
      duplex.close();
    },
  };
}
