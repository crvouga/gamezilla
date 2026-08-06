import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { NudgePayload } from '../shared/nudge-payload';

export type NotifyChannelsOptions = {
  readonly pubsub: PubSub;
  readonly topics: readonly Topic[];
  readonly checkpoint?: string;
  /** Mutation `writes` — client filters scopes by query `hydrates` overlap. */
  readonly tables?: readonly string[];
  /** Included in warn logs when publish fails. */
  readonly label?: string;
};

/**
 * Fire-and-forget invalidation publishes. Failures are logged, never retried,
 * and never thrown — callers must not await for correctness.
 */
export function notifyChannels(options: NotifyChannelsOptions): void {
  const seen = new Set<Topic>();
  const payload: NudgePayload = {
    ...(options.checkpoint !== undefined
      ? { checkpoint: options.checkpoint }
      : {}),
    ...(options.tables !== undefined && options.tables.length > 0
      ? { tables: options.tables }
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
