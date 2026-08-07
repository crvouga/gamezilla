import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { Mutation, MutationEnv } from '../mutations/core/types';
import {
  fanoutRowsWithinCap,
  selectFanoutRows,
} from '../shared/select-fanout-rows';

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

export type PublishOptimisticFanoutArgs = {
  readonly pubsub: PubSub;
  readonly db: SqlClient;
  readonly env: MutationEnv;
  readonly mutation: Mutation<unknown>;
  readonly args: unknown;
};

export type BuildOptimisticFanoutArgs = {
  readonly db: SqlClient;
  readonly env: MutationEnv;
  readonly mutation: Mutation<unknown>;
  readonly args: unknown;
};

/**
 * Build optimistic topic+payload pairs without publishing. Returns empty when
 * the mutation cannot produce a fanout hint.
 */
export async function buildOptimisticFanout(
  args: BuildOptimisticFanoutArgs
): Promise<readonly OutboundLiveItem[]> {
  const { mutation, env, db } = args;
  if (mutation.affectedRows === undefined) return [];

  let parsed: unknown;
  try {
    parsed = mutation.args.parse(args.args);
  } catch {
    return [];
  }

  const affected = mutation.affectedRows(parsed, env);
  if (Object.keys(affected).length === 0) return [];

  const rows = await selectFanoutRows(db, affected);
  if (Object.keys(rows).length === 0) return [];
  if (!fanoutRowsWithinCap(rows)) return [];

  const topics = await resolveOptimisticTopics(mutation, parsed, env, db);
  if (topics.length === 0) return [];

  const tables = [...mutation.declaredWrites];
  const payload: OptimisticFanoutPayload = {
    pushSeq: '0',
    optimistic: true,
    ...(tables.length > 0 ? { tables } : {}),
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

/**
 * Lossy peer-visible hint: publish local row images over MQTT immediately
 * after a successful local mutate, without waiting for server replay.
 * Server fanout + snapshots remain the source of truth.
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

async function resolveOptimisticTopics(
  mutation: Mutation<unknown>,
  parsed: unknown,
  env: MutationEnv,
  db: SqlClient
): Promise<Topic[]> {
  if (mutation.invalidates === undefined) return [];
  try {
    const topics = await Promise.resolve(mutation.invalidates(parsed, env, db));
    const seen = new Set<Topic>();
    const out: Topic[] = [];
    for (const topic of topics) {
      if (seen.has(topic)) continue;
      seen.add(topic);
      out.push(topic);
    }
    return out;
  } catch (error) {
    console.warn('[push] optimistic invalidates failed', error);
    return [];
  }
}
