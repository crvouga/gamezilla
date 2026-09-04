import type { Topic } from '@pkgs/pubsub/interface';

import type { MutationDb } from '../mutations/core/types';
import type { QueryRow } from '../queries/core/types';
import type { TopicMap, TopicMapCtx } from './topic-map';

type TopicRowBag = Map<Topic, Record<string, QueryRow[]>>;

function appendRowToTopic(
  out: TopicRowBag,
  topic: Topic,
  table: string,
  row: QueryRow
): void {
  let bag = out.get(topic);
  if (bag === undefined) {
    bag = {};
    out.set(topic, bag);
  }
  const list = bag[table];
  if (list === undefined) {
    bag[table] = [row];
    return;
  }
  list.push(row);
}

function addRowToTopics(
  out: TopicRowBag,
  table: string,
  row: QueryRow,
  topics: readonly Topic[]
): void {
  const seen = new Set<Topic>();
  for (const topic of topics) {
    if (seen.has(topic)) continue;
    seen.add(topic);
    appendRowToTopic(out, topic, table, row);
  }
}

/**
 * Restrict fanout row images to topics that the topic map assigns to each
 * row. Prevents device-private tables (empty / device topics) from riding
 * along on a sibling table's user wake in the same mutation.
 */
export async function partitionFanoutRowsByTopic(args: {
  readonly topicMap: TopicMap;
  readonly ctx: TopicMapCtx;
  readonly rows: Readonly<Record<string, readonly QueryRow[]>>;
  readonly db?: MutationDb;
}): Promise<Map<Topic, Record<string, QueryRow[]>>> {
  const out: TopicRowBag = new Map();
  for (const [table, tableRows] of Object.entries(args.rows)) {
    const entry = args.topicMap[table];
    if (entry === undefined) continue;
    for (const row of tableRows) {
      const topics = await Promise.resolve(
        entry.topics(row, args.ctx, args.db)
      );
      addRowToTopics(out, table, row, topics);
    }
  }
  return out;
}
