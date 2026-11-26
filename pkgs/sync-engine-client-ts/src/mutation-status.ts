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
  return (await mutationVerdict(db, mutationId)).status;
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

/** The queue retirement and its refusal commit together; observe them in one read. */
export async function readMutationSettlement(
  db: Pick<SqlClient, 'query'>,
  mutationId: string
): Promise<{ verdict: MutationVerdict; needsRepair: boolean }> {
  const [row] = await db.query(sql<{
    pending: number;
    rejection_id: string | null;
    optimistic_writes: number | null;
    code: string;
    message: string;
    meta: unknown;
  }>`
    SELECT (m.id IS NOT NULL AND m.deleted_at IS NULL) AS pending,
      m.optimistic_writes, r.id AS rejection_id, r.code, r.message, r.meta
    FROM (SELECT ${mutationId} AS id) AS choice
    LEFT JOIN sync_engine_mutations m ON m.id = choice.id
    LEFT JOIN sync_engine_write_rejections r ON r.mutation_id = choice.id AND r.deleted_at IS NULL
    LIMIT 1
  `);
  if (row?.rejection_id == null)
    return {
      verdict: { status: row?.pending ? 'pending' : 'confirmed' },
      needsRepair: false,
    };
  const meta = parsedMeta(row.meta);
  return {
    verdict: {
      status: 'rejected',
      code: row.code,
      message: row.message,
      ...(meta === undefined ? {} : { meta }),
    },
    // Older choices did not record their write set. Keep their repair barrier.
    needsRepair: row.optimistic_writes !== 0,
  };
}

/** {@link mutationStatus} plus the rejection's code and message. */
export async function mutationVerdict(
  db: Pick<SqlClient, 'query'>,
  mutationId: string
): Promise<MutationVerdict> {
  return (await readMutationSettlement(db, mutationId)).verdict;
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
