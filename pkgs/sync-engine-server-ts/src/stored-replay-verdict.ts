import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { mutationAppliedId } from '@pkgs/sync-engine-shared-ts/tables';
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
    meta: string | null;
  }>(sql`
    SELECT a.status, r.code, r.message, r.meta
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
  const meta: unknown = row.meta === null ? undefined : JSON.parse(row.meta);
  if (meta !== undefined)
    assert.record(meta, 'stored refusal details must be an object');
  return {
    status: 'rejected',
    code: row.code,
    message: row.message,
    ...(meta === undefined ? {} : { meta }),
  };
}
