import { join, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { managedUpdatedAtIso } from '../mutations/shared/managed-columns';
import { topicRowId } from '../shared/schema/tables';

/**
 * Pre-Phase-2 REST pushes used `${Date.now()}000000` (~1e18). Monotonic
 * allocateTopicPushSeq values stay small integers. Anything at/above this
 * floor is treated as an unknown baseline (ignore / restoreNetwork).
 */
const LEGACY_WALL_CLOCK_MIN = 10n ** 15n;

export type PushAppliedClock = {
  readonly now: () => number;
};

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
  topic: string,
  clock: PushAppliedClock
): Promise<string | null> {
  const rows = await db.query(sql<{ last_push_seq: string }>`
    SELECT last_push_seq FROM sync_engine_push_applied
    WHERE topic = ${topic}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const raw = rows[0]?.last_push_seq ?? null;
  if (raw === null) return null;
  if (!isLegacyWallClockCheckpoint(raw)) return raw;
  // Heal poisoned rows so own-ack floor / seq pushes can advance again.
  const ts = managedUpdatedAtIso(clock.now);
  await db.run(sql`
    UPDATE sync_engine_push_applied
    SET deleted_at = ${ts}, updated_at = ${ts}
    WHERE topic = ${topic}
      AND deleted_at IS NULL
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
  pushSeq: string,
  clock: PushAppliedClock
): Promise<boolean> {
  const prev = await readLastPushSeq(db, topic, clock);
  if (prev === null) return false;
  return compareCheckpoint(pushSeq, prev) <= 0;
}

/**
 * Raise `sync_engine_scope_meta.last_checkpoint` for scopes whose rows already
 * reflect a push minted at `checkpoint`. Snapshots read before that replay
 * then fail `isStale` instead of reviving overwritten rows. Scopes with no
 * meta row yet (never hydrated) are left alone — the first snapshot must land.
 */
export async function raiseScopeCheckpoints(
  db: SqlClient,
  scopeHashes: readonly string[],
  checkpoint: string,
  clock: PushAppliedClock
): Promise<void> {
  if (scopeHashes.length === 0) return;
  const rows = await db.query(sql<{
    scope_hash: string;
    last_checkpoint: string | null;
  }>`
    SELECT scope_hash, last_checkpoint FROM sync_engine_scope_meta
    WHERE scope_hash IN (${join(scopeHashes.map((h) => sql`${h}`))})
      AND deleted_at IS NULL
  `);
  const behind = rows
    .filter(
      (row) =>
        row.last_checkpoint === null ||
        compareCheckpoint(checkpoint, row.last_checkpoint) > 0
    )
    .map((row) => row.scope_hash);
  if (behind.length === 0) return;
  const ts = managedUpdatedAtIso(clock.now);
  await db.run(sql`
    UPDATE sync_engine_scope_meta
    SET last_checkpoint = ${checkpoint}, updated_at = ${ts}
    WHERE scope_hash IN (${join(behind.map((h) => sql`${h}`))})
      AND deleted_at IS NULL
  `);
}

export async function recordPushApplied(
  db: SqlClient,
  topic: string,
  pushSeq: string,
  clock: PushAppliedClock
): Promise<void> {
  if (isLegacyWallClockCheckpoint(pushSeq)) {
    return;
  }
  const prev = await readLastPushSeq(db, topic, clock);
  if (prev !== null && compareCheckpoint(pushSeq, prev) <= 0) return;
  const ts = managedUpdatedAtIso(clock.now);
  await db.run(sql`
    INSERT INTO sync_engine_push_applied (
      id, topic, last_push_seq, created_at, updated_at, deleted_at
    )
    VALUES (
      ${topicRowId(topic)},
      ${topic},
      ${pushSeq},
      ${ts},
      ${ts},
      ${null}
    )
    ON CONFLICT (id) DO UPDATE SET
      last_push_seq = excluded.last_push_seq,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `);
}

/** Drop tracking for topics no longer subscribed (membership remake). */
export async function clearRemovedPushApplied(
  db: SqlClient,
  retainedTopics: ReadonlySet<string>,
  clock: PushAppliedClock
): Promise<void> {
  const ts = managedUpdatedAtIso(clock.now);
  const rows = await db.query(sql<{ topic: string }>`
    SELECT topic FROM sync_engine_push_applied
    WHERE deleted_at IS NULL
  `);
  for (const row of rows) {
    if (retainedTopics.has(row.topic)) continue;
    await db.run(sql`
      UPDATE sync_engine_push_applied
      SET deleted_at = ${ts}, updated_at = ${ts}
      WHERE topic = ${row.topic}
        AND deleted_at IS NULL
    `);
  }
}
