import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { MutationEnv } from '../mutations/core/types';
import { fanoutRowsWithinCap } from '../shared/select-fanout-rows';
import {
  type TopicMap,
  topicMapCtxFromEnv,
  topicsFromWriteCapture,
} from '../shared/topic-map';
import type { WriteCaptureSnapshot } from '../sql-ast';

/** Cap queued outbound optimistic publishes (Tiger bound). */
const MAX_OUTBOUND_LIVE = 256;

export type OptimisticFanoutPayload = {
  readonly pushSeq: '0';
  readonly optimistic: true;
  readonly tables?: readonly string[];
  readonly rows: Readonly<Record<string, readonly Record<string, unknown>[]>>;
};

export type OutboundLiveItem = {
  readonly topic: Topic;
  readonly payload: OptimisticFanoutPayload;
};

export type BuildOptimisticFanoutArgs = {
  readonly db: SqlClient;
  readonly env: MutationEnv;
  readonly capture: WriteCaptureSnapshot;
  readonly topicMap?: TopicMap;
};

/**
 * Build optimistic topic+payload pairs from a local write capture.
 */
export async function buildOptimisticFanout(
  args: BuildOptimisticFanoutArgs
): Promise<readonly OutboundLiveItem[]> {
  const { env, capture, topicMap } = args;
  if (capture.tables.length === 0) return [];
  const rows = capture.images;
  if (Object.keys(rows).length === 0) return [];
  if (!fanoutRowsWithinCap(rows)) return [];

  const topics =
    topicMap === undefined
      ? []
      : await topicsFromWriteCapture({
          topicMap,
          capture,
          ctx: topicMapCtxFromEnv(env),
          db: args.db,
        });
  if (topics.length === 0) return [];

  const payload: OptimisticFanoutPayload = {
    pushSeq: '0',
    optimistic: true,
    tables: [...capture.tables],
    rows,
  };
  return topics.map((topic) => ({ topic, payload }));
}

async function publishItems(
  pubsub: PubSub,
  items: readonly OutboundLiveItem[]
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      pubsub.publish(item.topic, item.payload).catch((error: unknown) => {
        console.warn('[push] optimistic publish failed', item.topic, error);
      })
    )
  );
}

export type PublishOptimisticFanoutArgs = BuildOptimisticFanoutArgs & {
  readonly pubsub: PubSub;
};

/**
 * Lossy peer-visible hint: publish local row images over MQTT immediately
 * after a successful local mutate, without waiting for server replay.
 */
export async function publishOptimisticFanout(
  args: PublishOptimisticFanoutArgs
): Promise<void> {
  if (args.pubsub.status() !== 'connected') return;
  const items = await buildOptimisticFanout(args);
  if (items.length === 0) return;
  await publishItems(args.pubsub, items);
}

export type OutboundLiveBuffer = {
  readonly enqueue: (items: readonly OutboundLiveItem[]) => void;
  readonly flush: (pubsub: PubSub) => Promise<void>;
  readonly clear: () => void;
};

/** In-memory queue of optimistic publishes to flush when pubsub reconnects. */
export function createOutboundLiveBuffer(): OutboundLiveBuffer {
  const queue: OutboundLiveItem[] = [];
  return {
    enqueue(items) {
      for (const item of items) {
        queue.push(item);
        while (queue.length > MAX_OUTBOUND_LIVE) queue.shift();
      }
    },
    async flush(pubsub) {
      if (pubsub.status() !== 'connected' || queue.length === 0) return;
      const pending = queue.splice(0, queue.length);
      await publishItems(pubsub, pending);
    },
    clear() {
      queue.length = 0;
    },
  };
}
