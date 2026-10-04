import { assert } from '@pkgs/assert-root-shared/singleton';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { mutationAppliedId } from '@pkgs/sync-engine-shared/tables';
import type { ReplayOutcome } from './replay-mutation';

/** The permanent decision survives a lost response and rejection acknowledgement. */
export async function storedReplayVerdict(
  tx: SqlTx,
  mutationId: string
): Promise<ReplayOutcome> {
  const rows = await tx.query<{
    status: string;
    code: string | null;
    message: string | null;
  }>(sql`
    SELECT a.status, r.code, r.message
    FROM sync_engine_mutations_applied a
    LEFT JOIN sync_engine_write_rejections r ON r.mutation_id = a.mutation_id
    WHERE a.id = ${mutationAppliedId(mutationId)}
    LIMIT 1
  `);
  const row = rows[0];
  assert.ok(row !== undefined, 'duplicate mutation must have a stored verdict');
  if (row.status !== 'rejected') return { status: 'duplicate' };
  assert.ok(
    row.code !== null && row.message !== null,
    'rejected mutation must retain its refusal'
  );
  return { status: 'rejected', code: row.code, message: row.message };
}
