import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

export type MutationStatus = 'pending' | 'confirmed' | 'rejected';

export type MutationStatusDeps = {
  readonly db: Pick<SqlClient, 'query'>;
  /** True once the local `_mutations` row has left the upload queue. */
  readonly isMutationUploaded: (mutationId: string) => boolean;
  /**
   * True once a sync checkpoint has completed after that upload
   * (server-authoritative state has streamed down past the upload).
   */
  readonly hasSyncedPastUpload: (mutationId: string) => boolean;
};

/**
 * Derive confirmation status for a mutation id.
 * - rejected: write_rejections row exists for this mutation_id
 * - confirmed: uploaded and a subsequent sync checkpoint completed
 * - pending: otherwise
 */
export async function mutationStatus(
  deps: MutationStatusDeps,
  mutationId: string
): Promise<MutationStatus> {
  const rejections = await deps.db.query(sql<{ id: string }>`
    SELECT id FROM write_rejections WHERE mutation_id = ${mutationId} LIMIT 1
  `);
  if (rejections.length > 0) return 'rejected';

  if (
    deps.isMutationUploaded(mutationId) &&
    deps.hasSyncedPastUpload(mutationId)
  ) {
    return 'confirmed';
  }
  return 'pending';
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
