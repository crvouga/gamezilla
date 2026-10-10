import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

export type MutationStatus = 'pending' | 'confirmed' | 'rejected';

/** Match a choice's argument fields, such as the person or document it concerns. */
export type MutationFeedbackScope = Readonly<Record<string, string>>;

/** Durable feedback for the latest accepted local choice of one kind. */
export type MutationFeedback = {
  readonly mutationId: string;
  readonly status: MutationStatus;
  readonly rejectionId: string | null;
  readonly code: string | null;
  readonly message: string | null;
};

/**
 * Derive confirmation status for a mutation id.
 * - rejected: sync_engine_write_rejections row exists for this mutation_id
 * - pending: `sync_engine_mutations` queue row still exists
 * - confirmed: uploaded (queue row gone) and no rejection
 */
export async function mutationStatus(
  db: Pick<SqlClient, 'query'>,
  mutationId: string
): Promise<MutationStatus> {
  const rejections = await db.query(sql<{ id: string }>`
    SELECT id FROM sync_engine_write_rejections
    WHERE mutation_id = ${mutationId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  if (rejections.length > 0) return 'rejected';

  const pending = await db.query(sql<{ id: string }>`
    SELECT id FROM sync_engine_mutations
    WHERE id = ${mutationId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  if (pending.length > 0) return 'pending';
  return 'confirmed';
}

/** The server's answer for one mutation, with the reason when it refused. */
export type MutationVerdict =
  | { readonly status: 'pending' | 'confirmed' }
  | {
      readonly status: 'rejected';
      readonly code: string;
      readonly message: string;
    };

/** {@link mutationStatus} plus the rejection's code and message. */
export async function mutationVerdict(
  db: Pick<SqlClient, 'query'>,
  mutationId: string
): Promise<MutationVerdict> {
  const rejections = await db.query(sql<{ code: string; message: string }>`
    SELECT code, message FROM sync_engine_write_rejections
    WHERE mutation_id = ${mutationId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const rejection = rejections[0];
  if (rejection !== undefined) {
    return {
      status: 'rejected',
      code: rejection.code,
      message: rejection.message,
    };
  }
  const status = await mutationStatus(db, mutationId);
  // Rejected between the two reads: read the rejection it just stored.
  if (status === 'rejected') return mutationVerdict(db, mutationId);
  return { status };
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
    FROM sync_engine_write_rejections wr
    WHERE wr.client_id = ${clientId}
      AND wr.acknowledged = ${0}
      AND wr.deleted_at IS NULL
  `);
}

/** Pending upload queue depth for this client. */
export async function pendingMutationCount(
  db: Pick<SqlClient, 'query'>,
  clientId: string
): Promise<number> {
  const rows = await db.query(sql<{ c: number | string | bigint }>`
    SELECT COUNT(*) AS c FROM sync_engine_mutations
    WHERE client_id = ${clientId}
      AND deleted_at IS NULL
  `);
  return Number(rows[0]?.c ?? 0);
}
