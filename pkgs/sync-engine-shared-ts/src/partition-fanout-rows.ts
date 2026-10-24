import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';

import type { MutationDb } from './mutations-types';
import type { TopicMap, TopicMapCtx } from './topic-map';
import { resolveTopicsByRow } from './topic-map';
import type { QueryRow } from './v2';

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
    const topics = await resolveTopicsByRow({
      entry,
      rows: tableRows,
      ctx: args.ctx,
      ...(args.db === undefined ? {} : { db: args.db }),
    });
    for (const [index, row] of tableRows.entries())
      addRowToTopics(out, table, row, topics[index]!);
  }
  return out;
}
