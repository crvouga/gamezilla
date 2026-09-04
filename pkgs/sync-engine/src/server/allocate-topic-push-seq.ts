import type { Topic } from '@pkgs/pubsub/interface';
import { join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { managedUpdatedAtIso } from '../mutations/shared/managed-columns';
import { topicRowId } from '../shared/schema/tables';

/**
 * Allocate the next strictly monotonic pushSeq for a pubsub topic.
 *
 * Source of truth is Postgres `sync_engine_topic_seq`, advanced with an atomic upsert
 * so concurrent replays on the same topic serialize correctly. The wire value
 * is the decimal string of `n` (not Date.now()+ackSeq) so peers can detect gaps
 * with exact-next contiguous checks.
 *
 * Use `+ CAST(1 AS BIGINT)` (not bare `+ 1`): domain `integer` is physical
 * Postgres `bigint`, and postgres-mem `toI8` can leave JS numbers in int8
 * slots so `number + bigint` throws in V8. `CAST` is portable (SQLite +
 * Postgres); `1::bigint` is Postgres-only and fails on sim SQLite servers.
 */
export async function allocateTopicPushSeq(
  db: SqlClient,
  topic: Topic,
  now: () => number
): Promise<string> {
  const ts = managedUpdatedAtIso(now);
  const rows = await db.query(sql<{ n: number | string | bigint }>`
    INSERT INTO sync_engine_topic_seq (
      id, topic, n, created_at, updated_at, deleted_at
    )
    VALUES (
      ${topicRowId(topic)},
      ${topic},
      1,
      ${ts},
      ${ts},
      ${null}
    )
    ON CONFLICT (id) DO UPDATE
      SET n = sync_engine_topic_seq.n + CAST(1 AS BIGINT),
          updated_at = ${ts},
          deleted_at = NULL
    RETURNING n
  `);
  const n = rows[0]?.n;
  if (n === undefined) {
    throw new Error(`allocateTopicPushSeq: no row for topic=${topic}`);
  }
  return String(n);
}

function dedupeTopics(topics: readonly Topic[]): Topic[] {
  const out: Topic[] = [];
  const seen = new Set<Topic>();
  for (const topic of topics) {
    if (seen.has(topic)) continue;
    seen.add(topic);
    out.push(topic);
  }
  return out;
}

/**
 * Allocate one pushSeq per unique topic (deduped, stable order).
 * Uses a single multi-row upsert when there are 2+ topics (one DB RTT).
 */
export async function allocateTopicPushSeqs(
  db: SqlClient,
  topics: readonly Topic[],
  now: () => number
): Promise<ReadonlyMap<Topic, string>> {
  const unique = dedupeTopics(topics);
  const out = new Map<Topic, string>();
  if (unique.length === 0) return out;
  if (unique.length === 1) {
    const topic = unique[0]!;
    out.set(topic, await allocateTopicPushSeq(db, topic, now));
    return out;
  }

  const ts = managedUpdatedAtIso(now);
  const valueFrags = unique.map(
    (topic) => sql`(${topicRowId(topic)}, ${topic}, 1, ${ts}, ${ts}, ${null})`
  );
  const rows = await db.query(sql<{
    topic: string;
    n: number | string | bigint;
  }>`
    INSERT INTO sync_engine_topic_seq (
      id, topic, n, created_at, updated_at, deleted_at
    )
    VALUES ${join(valueFrags)}
    ON CONFLICT (id) DO UPDATE
      SET n = sync_engine_topic_seq.n + CAST(1 AS BIGINT),
          updated_at = ${ts},
          deleted_at = NULL
    RETURNING topic, n
  `);
  for (const row of rows) {
    out.set(row.topic as Topic, String(row.n));
  }
  for (const topic of unique) {
    if (out.has(topic)) continue;
    out.set(topic, await allocateTopicPushSeq(db, topic, now));
  }
  return out;
}
