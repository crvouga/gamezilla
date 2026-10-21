import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { warnPush } from '@pkgs/sync-engine-shared-ts/is-pubsub-closed-error';
import type { PushMessage, QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
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
  readonly now: () => number;
};

/**
 * Allocate pushSeqs via `sql`, then await transport acceptance of each push.
 *
 * Await this while `sql` is still connected (request-scoped clients are
 * disconnected when the handler returns). HTTP publication belongs to that
 * invocation too. Publish stays best-effort: failures
 * are logged, never retried, and never thrown.
 */
export async function notifyChannels(
  options: NotifyChannelsOptions
): Promise<void> {
  const label = options.label ?? 'notifyChannels';
  try {
    const pushSeqs = await allocateTopicPushSeqs(
      options.sql,
      options.topics,
      options.now
    );
    await publishPushMessages({
      pubsub: options.pubsub,
      pushSeqs,
      ...(options.tables !== undefined ? { tables: options.tables } : {}),
      ...(options.rows !== undefined ? { rows: options.rows } : {}),
      label,
    });
  } catch (error: unknown) {
    warnPush(`[pubsub] allocate/publish failed label=${label}`, error);
  }
}

/** Publish with pre-allocated pushSeqs (mutation replay txn / harness internals). */
export async function publishPushMessages(options: {
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
  /** Query-checkpoint minted after the replay committed (see `PushMessage`). */
  readonly checkpoint?: string;
  readonly label?: string;
}): Promise<void> {
  const label = options.label ?? 'publishPushMessages';
  await Promise.all(
    [...options.pushSeqs].map(async ([topic, pushSeq]) => {
      const topicRows = options.rowsByTopic?.get(topic) ?? options.rows;
      const tables =
        topicRows !== undefined && Object.keys(topicRows).length > 0
          ? Object.keys(topicRows).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
          : options.tables;
      const payload: PushMessage = {
        pushSeq,
        ...(tables !== undefined && tables.length > 0 ? { tables } : {}),
        ...(topicRows !== undefined && Object.keys(topicRows).length > 0
          ? { rows: topicRows }
          : {}),
        ...(options.checkpoint !== undefined
          ? { checkpoint: options.checkpoint }
          : {}),
      };
      try {
        await options.pubsub.publish(topic, payload);
      } catch (error: unknown) {
        warnPush(
          `[pubsub] publish failed topic=${topic} label=${label}`,
          error
        );
      }
    })
  );
}
