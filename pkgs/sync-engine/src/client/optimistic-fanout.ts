import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { MutationEnv } from '../mutations/core/types';
import { warnPush } from '../shared/is-pubsub-closed-error';
import { partitionFanoutRowsByTopic } from '../shared/partition-fanout-rows';
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
 * Row images are partitioned per topic so device-private tables do not
 * ride along on a sibling table's user wake.
 */
export async function buildOptimisticFanout(
  args: BuildOptimisticFanoutArgs
): Promise<readonly OutboundLiveItem[]> {
  const { env, capture, topicMap } = args;
  if (capture.tables.length === 0) return [];
  const rows = scrubIncompleteProfileImages(capture.images);
  if (Object.keys(rows).length === 0) return [];
  if (!fanoutRowsWithinCap(rows)) return [];

  if (topicMap === undefined) return [];
  const ctx = topicMapCtxFromEnv(env);
  const scrubbedCapture: WriteCaptureSnapshot = {
    tables: Object.keys(rows).sort(),
    ids: capture.ids,
    images: rows,
  };
  const topics = await topicsFromWriteCapture({
    topicMap,
    capture: scrubbedCapture,
    ctx,
    db: args.db,
  });
  if (topics.length === 0) return [];

  const partitioned = await partitionFanoutRowsByTopic({
    topicMap,
    ctx,
    rows,
    db: args.db,
  });
  const items: OutboundLiveItem[] = [];
  for (const topic of topics) {
    const topicRows = partitioned.get(topic) ?? {};
    const tableNames = Object.keys(topicRows).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    if (tableNames.length === 0) continue;
    items.push({
      topic,
      payload: {
        pushSeq: '0',
        optimistic: true,
        tables: tableNames,
        rows: topicRows,
      },
    });
  }
  return items;
}

/**
 * Same-account peers must not receive an empty-username profile seed from
 * ensureProfile — that upsert wipes a peer's already-assigned handle.
 */
function scrubIncompleteProfileImages(
  rows: Readonly<Record<string, readonly Record<string, unknown>[]>>
): Readonly<Record<string, readonly Record<string, unknown>[]>> {
  const profiles = rows['profile'];
  if (profiles === undefined) return rows;
  const kept = profiles.filter((row) => {
    const username = row['username'];
    return typeof username === 'string' && username.length > 0;
  });
  if (kept.length === profiles.length) return rows;
  const next: Record<string, readonly Record<string, unknown>[]> = {
    ...rows,
  };
  if (kept.length === 0) {
    delete next['profile'];
  } else {
    next['profile'] = kept;
  }
  return next;
}

async function publishItems(
  pubsub: PubSub,
  items: readonly OutboundLiveItem[]
): Promise<void> {
  await Promise.all(
    items.map((item) =>
      pubsub.publish(item.topic, item.payload).catch((error: unknown) => {
        warnPush(`[push] optimistic publish failed ${item.topic}`, error);
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
