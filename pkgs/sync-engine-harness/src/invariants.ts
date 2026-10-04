import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';

import type { TigerInvariant } from '@pkgs/sync-engine-shared/tiger-invariants';
import type { InvariantViolation } from './invariant-tracker';
import {
  checkCheckpointMonotonicPerScope,
  checkHealedQueueDrained,
  checkOptimisticMarkersHealed,
  checkPushSeqMonotonicPerTopic,
} from './invariant-tracker';

/** Revoke / dispose close the handle; seq checks must skip those clients. */
export function isClosedDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /closed database|database has closed|already closed|database is closed/i.test(
    message
  );
}

/** Auth revoke wipes close the handle; preserveLocalDb must not reuse it. */
export async function isDbOpen(db: SqlClient): Promise<boolean> {
  try {
    await db.query(sql<{ ok: number }>`SELECT 1 AS ok`);
    return true;
  } catch {
    return false;
  }
}

/** Pending mutation seqs must be strictly increasing per client. */
export async function checkSeqMonotonicity(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const rows = await db.query(sql<{
    client_id: string;
    seq: number;
  }>`
    SELECT client_id, seq FROM sync_engine_mutations
    WHERE deleted_at IS NULL
    ORDER BY client_id ASC, seq ASC
  `);
  let lastClient = '';
  let lastSeq = -1;
  for (const row of rows) {
    if (row.client_id !== lastClient) {
      lastClient = row.client_id;
      lastSeq = row.seq;
      continue;
    }
    if (row.seq <= lastSeq) {
      return {
        invariant: 'seq-monotonicity',
        detail: `client=${row.client_id} seq ${row.seq} <= ${lastSeq}`,
      };
    }
    lastSeq = row.seq;
  }
  return null;
}

/** Rejected mutation ids must not remain in the pending upload queue. */
export async function checkRejectedNotPending(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const rows = await db.query(sql<{ mutation_id: string }>`
    SELECT r.mutation_id
    FROM sync_engine_write_rejections r
    INNER JOIN sync_engine_mutations m ON m.id = r.mutation_id
    WHERE r.deleted_at IS NULL
      AND m.deleted_at IS NULL
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    invariant: 'permanent-vs-transient-verdicts',
    detail: `rejected mutation still pending: ${row.mutation_id}`,
  };
}

export async function checkClientFrameworkInvariants(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const seq = await checkSeqMonotonicity(db);
  if (seq !== null) return seq;
  const rejected = await checkRejectedNotPending(db);
  if (rejected !== null) return rejected;
  const pushSeq = await checkPushSeqMonotonicPerTopic(db);
  if (pushSeq !== null) return pushSeq;
  return checkCheckpointMonotonicPerScope(db);
}

/** Post-settle checks — only after restoreNetwork + domain convergence. */
export async function checkPostInSyncInvariants(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const markers = await checkOptimisticMarkersHealed(db);
  if (markers !== null) return markers;
  return checkHealedQueueDrained(db);
}

export type PostConvergeInvariant = Extract<
  TigerInvariant,
  'optimistic-markers-healed-after-converge' | 'healed-queue-drained'
>;
