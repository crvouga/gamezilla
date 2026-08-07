import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { QueryRow } from '../queries/core/types';
import type { PushMessage } from '../shared/push-payload';

export type NotifyChannelsOptions = {
  readonly pubsub: PubSub;
  readonly topics: readonly Topic[];
  /** Required: strictly monotonic per-topic pushSeq (decimal string). */
  readonly pushSeq: string;
  /** Mutation `declaredWrites` — client filters scopes by query `hydrates` overlap. */
  readonly tables?: readonly string[];
  /** Post-replay row images (lossy fanout optimization). */
  readonly rows?: Readonly<Record<string, readonly QueryRow[]>>;
  /** Included in warn logs when publish fails. */
  readonly label?: string;
};

/**
 * Fire-and-forget invalidation publishes. Failures are logged, never retried,
 * and never thrown — callers must not await for correctness.
 *
 * `pushSeq` is required on the wire. Callers that touch multiple topics should
 * allocate one pushSeq per topic and call this once per topic.
 */
export function notifyChannels(options: NotifyChannelsOptions): void {
  const seen = new Set<Topic>();
  const payload: PushMessage = {
    pushSeq: options.pushSeq,
    ...(options.tables !== undefined && options.tables.length > 0
      ? { tables: options.tables }
      : {}),
    ...(options.rows !== undefined && Object.keys(options.rows).length > 0
      ? { rows: options.rows }
      : {}),
  };
  const label = options.label ?? 'notifyChannels';
  for (const topic of options.topics) {
    if (seen.has(topic)) continue;
    seen.add(topic);
    void options.pubsub.publish(topic, payload).catch((error: unknown) => {
      console.warn(
        `[pubsub] publish failed topic=${topic} label=${label}`,
        error
      );
    });
  }
}
