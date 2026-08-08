import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type MutationStatus = 'pending' | 'confirmed' | 'rejected';

/**
 * Derive confirmation status for a mutation id.
 * - rejected: write_rejections row exists for this mutation_id
 * - pending: `_mutations` queue row still exists
 * - confirmed: uploaded (queue row gone) and no rejection
 */
export async function mutationStatus(
  db: Pick<SqlClient, 'query'>,
  mutationId: string
): Promise<MutationStatus> {
  const rejections = await db.query(sql<{ id: string }>`
    SELECT id FROM write_rejections WHERE mutation_id = ${mutationId} LIMIT 1
  `);
  if (rejections.length > 0) return 'rejected';

  const pending = await db.query(sql<{ id: string }>`
    SELECT id FROM _mutations WHERE id = ${mutationId} LIMIT 1
  `);
  if (pending.length > 0) return 'pending';
  return 'confirmed';
}

export type UnackedWriteRejection = {
  readonly id: string;
  readonly mutationId: string;
  readonly code: string;
  readonly message: string;
  readonly meta: string | null;
};

/** Unacknowledged rejections for this client (uses synced `acknowledged` flag). */
export async function listUnackedWriteRejections(
  db: Pick<SqlClient, 'query'>,
  clientId: string
): Promise<readonly UnackedWriteRejection[]> {
  return db.query(sql<UnackedWriteRejection>`
    SELECT
      wr.id AS id,
      wr.mutation_id AS "mutationId",
      wr.code AS code,
      wr.message AS message,
      wr.meta AS meta
    FROM write_rejections wr
    WHERE wr.client_id = ${clientId}
      AND wr.acknowledged = ${0}
  `);
}

/** Pending upload queue depth for this client. */
export async function pendingMutationCount(
  db: Pick<SqlClient, 'query'>,
  clientId: string
): Promise<number> {
  const rows = await db.query(sql<{ c: number | string | bigint }>`
    SELECT COUNT(*) AS c FROM _mutations WHERE client_id = ${clientId}
  `);
  return Number(rows[0]?.c ?? 0);
}
