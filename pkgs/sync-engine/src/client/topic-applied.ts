import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

/**
 * Pre-Phase-2 REST nudges used `${Date.now()}000000` (~1e18). Monotonic
 * allocateTopicCheckpoint values stay small integers. Anything at/above this
 * floor is treated as an unknown baseline (ignore / heal).
 */
const LEGACY_WALL_CLOCK_MIN = 10n ** 15n;

/** Compare nudge/query checkpoints as bigints when both are integer strings. */
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

/** True for pre-Phase-2 Date.now-style checkpoint strings. */
export function isLegacyWallClockCheckpoint(checkpoint: string): boolean {
  try {
    return BigInt(checkpoint) >= LEGACY_WALL_CLOCK_MIN;
  } catch {
    return false;
  }
}

/**
 * True when checkpoint is exactly last_applied + 1 (contiguous for row apply).
 * Unknown / legacy baseline: allow apply when the caller already has row images
 * (tryApply only); recording the checkpoint establishes the seq baseline.
 * Legacy wall-clock baselines are treated as unknown.
 */
export function isContiguousNext(
  lastApplied: string | null,
  checkpoint: string
): boolean {
  try {
    const baseline =
      lastApplied !== null && isLegacyWallClockCheckpoint(lastApplied)
        ? null
        : lastApplied;
    if (baseline === null) return true;
    return BigInt(checkpoint) === BigInt(baseline) + 1n;
  } catch {
    return false;
  }
}

export async function readTopicLastApplied(
  db: SqlClient,
  topic: string
): Promise<string | null> {
  const rows = await db.query(sql<{ last_applied: string }>`
    SELECT last_applied FROM _topic_applied
    WHERE topic = ${topic}
    LIMIT 1
  `);
  const raw = rows[0]?.last_applied ?? null;
  if (raw === null) return null;
  if (!isLegacyWallClockCheckpoint(raw)) return raw;
  // Heal poisoned rows so own-ack floor / seq nudges can advance again.
  await db.run(sql`
    DELETE FROM _topic_applied WHERE topic = ${topic}
  `);
  return null;
}

/**
 * True when this nudge checkpoint is stale vs a known last_applied.
 * Unknown baseline (no row / legacy) → never stale — always proceed.
 */
export async function isNudgeCheckpointStale(
  db: SqlClient,
  topic: string,
  checkpoint: string
): Promise<boolean> {
  const prev = await readTopicLastApplied(db, topic);
  if (prev === null) return false;
  return compareCheckpoint(checkpoint, prev) <= 0;
}

export async function recordTopicApplied(
  db: SqlClient,
  topic: string,
  checkpoint: string
): Promise<void> {
  if (isLegacyWallClockCheckpoint(checkpoint)) {
    // Never persist wall-clock checkpoints into the seq tracker.
    return;
  }
  const prev = await readTopicLastApplied(db, topic);
  if (prev !== null && compareCheckpoint(checkpoint, prev) <= 0) return;
  await db.run(sql`
    INSERT INTO _topic_applied (topic, last_applied)
    VALUES (${topic}, ${checkpoint})
    ON CONFLICT (topic) DO UPDATE SET
      last_applied = excluded.last_applied
  `);
}

/** Drop tracking for topics no longer subscribed (membership remake). */
export async function clearRemovedTopicApplied(
  db: SqlClient,
  retainedTopics: ReadonlySet<string>
): Promise<void> {
  const rows = await db.query(sql<{ topic: string }>`
    SELECT topic FROM _topic_applied
  `);
  for (const row of rows) {
    if (retainedTopics.has(row.topic)) continue;
    await db.run(sql`
      DELETE FROM _topic_applied WHERE topic = ${row.topic}
    `);
  }
}
