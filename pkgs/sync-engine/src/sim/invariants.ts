import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { TigerInvariant } from '../queries/shared/tiger-invariants';

export type InvariantViolation = {
  readonly invariant: TigerInvariant | 'convergence';
  readonly detail: string;
};

/** Revoke / dispose close the handle; seq checks must skip those clients. */
export function isClosedDatabaseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /closed database|already closed|database is closed/i.test(message);
}

/** Pending mutation seqs must be strictly increasing per client. */
export async function checkSeqMonotonicity(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const rows = await db.query(sql<{
    client_id: string;
    seq: number;
  }>`
    SELECT client_id, seq FROM sync_engine_mutations ORDER BY client_id ASC, seq ASC
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
