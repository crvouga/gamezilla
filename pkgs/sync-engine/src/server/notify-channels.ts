import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { QueryRow } from '../protocol';
import type { PushMessage } from '../shared/push-payload';
import { allocateTopicPushSeqs } from './allocate-topic-push-seq';

export type NotifyChannelsOptions = {
  readonly pubsub: PubSub;
  /** Allocates strictly monotonic per-topic pushSeqs (hosts never touch sequences). */
  readonly sql: SqlClient;
  readonly topics: readonly Topic[];
  /** Captured write tables — client filters scopes by query `hydrates` overlap. */
  readonly tables?: readonly string[];
  /** Post-replay row images (lossy fanout optimization). */
  readonly rows?: Readonly<Record<string, readonly QueryRow[]>>;
  /** Included in warn logs when publish fails. */
  readonly label?: string;
  /**
   * When set, publish runs on this scheduler after allocate. Use a macrotask
   * (`io.timers.setTimeout(run, 0)`) so in-memory pubsub does not re-enter the
   * still-open request (overlapping pg-mem / Hono hangs under Jest).
   */
  readonly schedulePublish?: (run: () => void) => void;
};

/**
 * Allocate pushSeqs via `sql`, then fire-and-forget the pubsub publish.
 *
 * Await this while `sql` is still connected (request-scoped clients are
 * disconnected when the handler returns). Publish stays best-effort: failures
 * are logged, never retried, and never thrown.
 */
export async function notifyChannels(
  options: NotifyChannelsOptions
): Promise<void> {
  const label = options.label ?? 'notifyChannels';
  try {
    const pushSeqs = await allocateTopicPushSeqs(options.sql, options.topics);
    const publish = (): void => {
      publishPushMessages({
        pubsub: options.pubsub,
        pushSeqs,
        ...(options.tables !== undefined ? { tables: options.tables } : {}),
        ...(options.rows !== undefined ? { rows: options.rows } : {}),
        label,
      });
    };
    if (options.schedulePublish !== undefined) {
      options.schedulePublish(publish);
    } else {
      publish();
    }
  } catch (error: unknown) {
    console.warn(`[pubsub] allocate/publish failed label=${label}`, error);
  }
}

/** Publish with pre-allocated pushSeqs (mutation replay txn / sim internals). */
export function publishPushMessages(options: {
  readonly pubsub: PubSub;
  readonly pushSeqs: ReadonlyMap<Topic, string>;
  readonly tables?: readonly string[];
  /** Same row bag on every topic (legacy). Prefer {@link rowsByTopic}. */
  readonly rows?: Readonly<Record<string, readonly QueryRow[]>>;
  /** Per-topic row images from topic-map partition. */
  readonly rowsByTopic?: ReadonlyMap<
    Topic,
    Readonly<Record<string, readonly QueryRow[]>>
  >;
  readonly label?: string;
}): void {
  const label = options.label ?? 'publishPushMessages';
  for (const [topic, pushSeq] of options.pushSeqs) {
    const topicRows = options.rowsByTopic?.get(topic) ?? options.rows;
    const tables =
      topicRows !== undefined && Object.keys(topicRows).length > 0
        ? Object.keys(topicRows)
        : options.tables;
    const payload: PushMessage = {
      pushSeq,
      ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
      ...(topicRows !== undefined && Object.keys(topicRows).length > 0
        ? { rows: topicRows }
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
