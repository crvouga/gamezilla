import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../protocol/v1';
import type { PushMessage } from '../shared/push-payload';
import { allocateTopicPushSeqs } from './allocate-topic-push-seq';

export type NotifyChannelsOptions = {
  readonly pubsub: PubSub;
  /** Allocates strictly monotonic per-topic pushSeqs (hosts never touch sequences). */
  readonly sql: SqlClient;
  readonly topics: readonly Topic[];
  /** Mutation `declaredWrites` — client filters scopes by query `hydrates` overlap. */
  readonly tables?: readonly string[];
  /** Post-replay row images (lossy fanout optimization). */
  readonly rows?: Readonly<Record<string, readonly QueryRow[]>>;
  /** Included in warn logs when publish fails. */
  readonly label?: string;
};

/**
 * Fire-and-forget invalidation publishes. Allocates pushSeqs via `sql`, then
 * publishes. Failures are logged, never retried, and never thrown — callers
 * must not await for correctness.
 */
export function notifyChannels(options: NotifyChannelsOptions): void {
  const label = options.label ?? 'notifyChannels';
  void (async () => {
    try {
      const pushSeqs = await allocateTopicPushSeqs(options.sql, options.topics);
      publishPushMessages({
        pubsub: options.pubsub,
        pushSeqs,
        ...(options.tables !== undefined ? { tables: options.tables } : {}),
        ...(options.rows !== undefined ? { rows: options.rows } : {}),
        label,
      });
    } catch (error: unknown) {
      console.warn(`[pubsub] allocate/publish failed label=${label}`, error);
    }
  })();
}

/** Publish with pre-allocated pushSeqs (mutation replay txn / sim internals). */
export function publishPushMessages(options: {
  readonly pubsub: PubSub;
  readonly pushSeqs: ReadonlyMap<Topic, string>;
  readonly tables?: readonly string[];
  readonly rows?: Readonly<Record<string, readonly QueryRow[]>>;
  readonly label?: string;
}): void {
  const label = options.label ?? 'publishPushMessages';
  for (const [topic, pushSeq] of options.pushSeqs) {
    const payload: PushMessage = {
      pushSeq,
      ...(options.tables !== undefined && options.tables.length > 0
        ? { tables: options.tables }
        : {}),
      ...(options.rows !== undefined && Object.keys(options.rows).length > 0
        ? { rows: options.rows }
        : {}),
    };
    void options.pubsub.publish(topic, payload).catch((error: unknown) => {
      console.warn(
        `[pubsub] publish failed topic=${topic} label=${label}`,
        error
      );
    });
  }
}
