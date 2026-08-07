import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { Mutation, MutationEnv } from '../mutations/core/types';
import {
  fanoutRowsWithinCap,
  selectFanoutRows,
} from '../shared/select-fanout-rows';

export type PublishOptimisticFanoutArgs = {
  readonly pubsub: PubSub;
  readonly db: SqlClient;
  readonly env: MutationEnv;
  readonly mutation: Mutation<unknown>;
  readonly args: unknown;
};

/**
 * Lossy peer-visible hint: publish local row images over MQTT immediately
 * after a successful local mutate, without waiting for server replay.
 * Server fanout + snapshots remain the source of truth.
 */
export async function publishOptimisticFanout(
  args: PublishOptimisticFanoutArgs
): Promise<void> {
  const { mutation, env, db, pubsub } = args;
  if (mutation.affectedRows === undefined) return;
  if (pubsub.status() !== 'connected') return;

  let parsed: unknown;
  try {
    parsed = mutation.args.parse(args.args);
  } catch {
    return;
  }

  const affected = mutation.affectedRows(parsed, env);
  if (Object.keys(affected).length === 0) return;

  const rows = await selectFanoutRows(db, affected);
  if (Object.keys(rows).length === 0) return;
  if (!fanoutRowsWithinCap(rows)) return;

  const topics = await resolveOptimisticTopics(mutation, parsed, env, db);
  if (topics.length === 0) return;

  const tables = [...mutation.declaredWrites];
  const payload = {
    pushSeq: '0',
    optimistic: true as const,
    ...(tables.length > 0 ? { tables } : {}),
    rows,
  };

  await Promise.all(
    topics.map((topic) =>
      pubsub.publish(topic, payload).catch((error: unknown) => {
        console.warn('[push] optimistic publish failed', topic, error);
      })
    )
  );
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
