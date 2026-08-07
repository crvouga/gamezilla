import type { Topic } from '@pkgs/pubsub/interface';
import { join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Allocate the next strictly monotonic checkpoint for a pubsub topic.
 *
 * Source of truth is Postgres `_sync_topic_checkpoint`, advanced with an
 * atomic upsert so concurrent replays on the same topic serialize correctly.
 * The wire value is the decimal string of `n` (not Date.now()+ackSeq) so
 * peers can detect gaps with exact-next contiguous checks.
 */
export async function allocateTopicCheckpoint(
  db: SqlClient,
  topic: Topic
): Promise<string> {
  const rows = await db.query(sql<{ n: number | string | bigint }>`
    INSERT INTO _sync_topic_checkpoint (topic, n)
    VALUES (${topic}, 1)
    ON CONFLICT (topic) DO UPDATE
      SET n = _sync_topic_checkpoint.n + 1
    RETURNING n
  `);
  const n = rows[0]?.n;
  if (n === undefined) {
    throw new Error(`allocateTopicCheckpoint: no row for topic=${topic}`);
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
 * Allocate one checkpoint per unique topic (deduped, stable order).
 * Uses a single multi-row upsert when there are 2+ topics (one DB RTT).
 */
export async function allocateTopicCheckpoints(
  db: SqlClient,
  topics: readonly Topic[]
): Promise<ReadonlyMap<Topic, string>> {
  const unique = dedupeTopics(topics);
  const out = new Map<Topic, string>();
  if (unique.length === 0) return out;
  if (unique.length === 1) {
    const topic = unique[0]!;
    out.set(topic, await allocateTopicCheckpoint(db, topic));
    return out;
  }

  const valueFrags = unique.map((topic) => sql`(${topic}, 1)`);
  const rows = await db.query(sql<{
    topic: string;
    n: number | string | bigint;
  }>`
    INSERT INTO _sync_topic_checkpoint (topic, n)
    VALUES ${join(valueFrags)}
    ON CONFLICT (topic) DO UPDATE
      SET n = _sync_topic_checkpoint.n + 1
    RETURNING topic, n
  `);
  for (const row of rows) {
    out.set(row.topic as Topic, String(row.n));
  }
  // Preserve input order for any topic missing from RETURNING (should not happen).
  for (const topic of unique) {
    if (out.has(topic)) continue;
    out.set(topic, await allocateTopicCheckpoint(db, topic));
  }
  return out;
}
