import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Pre-Phase-2 REST pushes used `${Date.now()}000000` (~1e18). Monotonic
 * allocateTopicPushSeq values stay small integers. Anything at/above this
 * floor is treated as an unknown baseline (ignore / heal).
 */
const LEGACY_WALL_CLOCK_MIN = 10n ** 15n;

/** Compare push/query sequence strings as bigints when both are integer strings. */
export function compareCheckpoint(a: string, b: string): number {
  try {
    const da = BigInt(a);
    const db = BigInt(b);
    if (da === db) return 0;
    return da < db ? -1 : 1;
  } catch {
    return a < b ? -1 : a > b ? 1 : 0;
  }
}

/** True for pre-Phase-2 Date.now-style sequence strings. */
export function isLegacyWallClockCheckpoint(checkpoint: string): boolean {
  try {
    return BigInt(checkpoint) >= LEGACY_WALL_CLOCK_MIN;
  } catch {
    return false;
  }
}

/**
 * True when pushSeq is exactly last_push_seq + 1 (contiguous for row apply).
 * Unknown / legacy baseline: allow apply when the caller already has row images
 * (tryApply only); recording the pushSeq establishes the seq baseline.
 * Legacy wall-clock baselines are treated as unknown.
 */
export function isContiguousNext(
  lastPushSeq: string | null,
  pushSeq: string
): boolean {
  try {
    const baseline =
      lastPushSeq !== null && isLegacyWallClockCheckpoint(lastPushSeq)
        ? null
        : lastPushSeq;
    if (baseline === null) return true;
    return BigInt(pushSeq) === BigInt(baseline) + 1n;
  } catch {
    return false;
  }
}

export async function readLastPushSeq(
  db: SqlClient,
  topic: string
): Promise<string | null> {
  const rows = await db.query(sql<{ last_push_seq: string }>`
    SELECT last_push_seq FROM sync_engine_push_applied
    WHERE topic = ${topic}
    LIMIT 1
  `);
  const raw = rows[0]?.last_push_seq ?? null;
  if (raw === null) return null;
  if (!isLegacyWallClockCheckpoint(raw)) return raw;
  // Heal poisoned rows so own-ack floor / seq pushes can advance again.
  await db.run(sql`
    DELETE FROM sync_engine_push_applied WHERE topic = ${topic}
  `);
  return null;
}

/**
 * True when this pushSeq is stale vs a known last_push_seq.
 * Unknown baseline (no row / legacy) → never stale — always proceed.
 */
export async function isPushSeqStale(
  db: SqlClient,
  topic: string,
  pushSeq: string
): Promise<boolean> {
  const prev = await readLastPushSeq(db, topic);
  if (prev === null) return false;
  return compareCheckpoint(pushSeq, prev) <= 0;
}

export async function recordPushApplied(
  db: SqlClient,
  topic: string,
  pushSeq: string
): Promise<void> {
  if (isLegacyWallClockCheckpoint(pushSeq)) {
    // Never persist wall-clock sequences into the pushSeq tracker.
    return;
  }
  const prev = await readLastPushSeq(db, topic);
  if (prev !== null && compareCheckpoint(pushSeq, prev) <= 0) return;
  await db.run(sql`
    INSERT INTO sync_engine_push_applied (topic, last_push_seq)
    VALUES (${topic}, ${pushSeq})
    ON CONFLICT (topic) DO UPDATE SET
      last_push_seq = excluded.last_push_seq
  `);
}

/** Drop tracking for topics no longer subscribed (membership remake). */
export async function clearRemovedPushApplied(
  db: SqlClient,
  retainedTopics: ReadonlySet<string>
): Promise<void> {
  const rows = await db.query(sql<{ topic: string }>`
    SELECT topic FROM sync_engine_push_applied
  `);
  for (const row of rows) {
    if (retainedTopics.has(row.topic)) continue;
    await db.run(sql`
      DELETE FROM sync_engine_push_applied WHERE topic = ${row.topic}
    `);
  }
}
