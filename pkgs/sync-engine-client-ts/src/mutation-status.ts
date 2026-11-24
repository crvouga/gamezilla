import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

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
      /** What the refusal carried for the device (e.g. a permission decision). */
      readonly meta?: Readonly<Record<string, unknown>> | undefined;
    };

/** A stored rejection's meta, as the refusal sent it; anything else is none. */
function parsedMeta(
  meta: unknown
): Readonly<Record<string, unknown>> | undefined {
  if (meta === null || meta === undefined) return undefined;
  if (typeof meta === 'object') return meta as Record<string, unknown>;
  if (typeof meta !== 'string') return undefined;
  try {
    const value: unknown = JSON.parse(meta);
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** {@link mutationStatus} plus the rejection's code and message. */
export async function mutationVerdict(
  db: Pick<SqlClient, 'query'>,
  mutationId: string
): Promise<MutationVerdict> {
  const rejections = await db.query(sql<{
    code: string;
    message: string;
    meta: unknown;
  }>`
    SELECT code, message, meta FROM sync_engine_write_rejections
    WHERE mutation_id = ${mutationId}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const rejection = rejections[0];
  if (rejection !== undefined) {
    const meta = parsedMeta(rejection.meta);
    return {
      status: 'rejected',
      code: rejection.code,
      message: rejection.message,
      ...(meta === undefined ? {} : { meta }),
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
