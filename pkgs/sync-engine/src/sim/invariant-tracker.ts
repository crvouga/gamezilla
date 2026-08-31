import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  compareCheckpoint,
  isLegacyWallClockCheckpoint,
} from '../client/push-applied';
import type { TigerInvariant } from '../queries/shared/tiger-invariants';

export type InvariantViolation = {
  readonly invariant: TigerInvariant | 'convergence';
  readonly detail: string;
};

type DbTracker = {
  readonly pushSeqByTopic: Map<string, string>;
  readonly checkpointByScope: Map<string, string>;
};

const trackers = new WeakMap<object, DbTracker>();

function trackerFor(db: object): DbTracker {
  const existing = trackers.get(db);
  if (existing !== undefined) return existing;
  const created: DbTracker = {
    pushSeqByTopic: new Map(),
    checkpointByScope: new Map(),
  };
  trackers.set(db, created);
  return created;
}

/** Drop monotonic baselines when the client DB is replaced (fresh open). */
export function resetInvariantTracker(db: object): void {
  trackers.delete(db);
}

function checkMonotonicAdvance(args: {
  readonly map: Map<string, string>;
  readonly key: string;
  readonly next: string;
  readonly invariant: TigerInvariant;
  readonly label: string;
}): InvariantViolation | null {
  const prev = args.map.get(args.key);
  if (prev !== undefined && compareCheckpoint(args.next, prev) < 0) {
    return {
      invariant: args.invariant,
      detail: `${args.label}=${args.key} regressed ${args.next} < ${prev}`,
    };
  }
  args.map.set(args.key, args.next);
  return null;
}

/** Push seq must never regress for a topic on this client DB. */
export async function checkPushSeqMonotonicPerTopic(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const state = trackerFor(db);
  const rows = await db.query(sql<{
    topic: string;
    last_push_seq: string;
  }>`
    SELECT topic, last_push_seq FROM sync_engine_push_applied
  `);
  for (const row of rows) {
    if (isLegacyWallClockCheckpoint(row.last_push_seq)) {
      return {
        invariant: 'push-seq-monotonic-per-topic',
        detail: `legacy push seq topic=${row.topic}`,
      };
    }
    try {
      BigInt(row.last_push_seq);
    } catch {
      return {
        invariant: 'push-seq-monotonic-per-topic',
        detail: `invalid push seq topic=${row.topic}`,
      };
    }
    const regressed = checkMonotonicAdvance({
      map: state.pushSeqByTopic,
      key: row.topic,
      next: row.last_push_seq,
      invariant: 'push-seq-monotonic-per-topic',
      label: 'topic',
    });
    if (regressed !== null) return regressed;
  }
  return null;
}

/** Scope checkpoint must never regress while the scope row exists. */
export async function checkCheckpointMonotonicPerScope(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const state = trackerFor(db);
  const rows = await db.query(sql<{
    scope_hash: string;
    last_checkpoint: string | null;
  }>`
    SELECT scope_hash, last_checkpoint FROM sync_engine_scope_meta
  `);
  for (const row of rows) {
    const checkpoint = row.last_checkpoint;
    if (checkpoint === null || checkpoint.length === 0) continue;
    if (isLegacyWallClockCheckpoint(checkpoint)) {
      state.checkpointByScope.delete(row.scope_hash);
      continue;
    }
    const regressed = checkMonotonicAdvance({
      map: state.checkpointByScope,
      key: row.scope_hash,
      next: checkpoint,
      invariant: 'checkpoint-monotonic-per-scope',
      label: 'scope',
    });
    if (regressed !== null) return regressed;
  }
  return null;
}

/** After converge, speculative peer markers must be healed away. */
export async function checkOptimisticMarkersHealed(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const rows = await db.query(sql<{ c: number | string }>`
    SELECT COUNT(*) AS c FROM sync_engine_optimistic_peer_rows
  `);
  const count = Number(rows[0]?.c ?? 0);
  if (count === 0) return null;
  return {
    invariant: 'optimistic-markers-healed-after-converge',
    detail: `${count} optimistic peer marker(s) remain`,
  };
}

/** After heal+converge, online clients must have drained upload queues. */
export async function checkHealedQueueDrained(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const rows = await db.query(sql<{ c: number | string }>`
    SELECT COUNT(*) AS c FROM sync_engine_mutations
  `);
  const count = Number(rows[0]?.c ?? 0);
  if (count === 0) return null;
  return {
    invariant: 'healed-queue-drained',
    detail: `${count} pending mutation(s) remain`,
  };
}
