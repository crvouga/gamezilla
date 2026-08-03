import type { Rule, RulesAuth } from '@pkgs/rules/core/types';
import { runRules } from '@pkgs/rules/core/run-rules';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type {
  UploadBatch,
  UploadRow,
} from '@pkgs/sync-engine/shared/upload-batch';

/**
 * Pinned PowerSync `ps_crud` row shape (SDK 1.57.x).
 * If the SDK changes columns, the contract test in `ps-crud-shape.test.ts` fails.
 */
export type PsCrudRow = {
  readonly id: number | string;
  readonly tx_id: number | string | null;
  readonly data: string;
};

type CrudDataJson = {
  readonly op: 'PUT' | 'PATCH' | 'DELETE';
  readonly type: string;
  readonly id: string;
  readonly data?: Record<string, unknown>;
};

export async function readPsCrudMaxId(
  db: Pick<SqlClient, 'query'>
): Promise<number> {
  const rows = await db.query<{ max_id: number | string | null }>(
    sql`SELECT MAX(id) AS max_id FROM ps_crud`
  );
  const raw = rows[0]?.max_id;
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function mapPsCrudDataToUploadRow(dataJson: string): UploadRow {
  const parsed = JSON.parse(dataJson) as CrudDataJson;
  if (parsed.op === 'DELETE') {
    return { op: 'delete', table: parsed.type, id: parsed.id };
  }
  if (parsed.op === 'PATCH') {
    return {
      op: 'patch',
      table: parsed.type,
      id: parsed.id,
      values: parsed.data ?? {},
    };
  }
  return {
    op: 'put',
    table: parsed.type,
    id: parsed.id,
    values: { id: parsed.id, ...(parsed.data ?? {}) },
  };
}

export async function readUploadBatchSinceWatermark(
  db: Pick<SqlClient, 'query'>,
  watermark: number
): Promise<UploadBatch> {
  const rows = await db.query<PsCrudRow>(
    sql`SELECT id, tx_id, data FROM ps_crud WHERE id > ${watermark} ORDER BY id ASC`
  );
  return { rows: rows.map((row) => mapPsCrudDataToUploadRow(row.data)) };
}

export type ValidatedWriteOptions<T, TAuth extends RulesAuth = RulesAuth> = {
  readonly sql: SqlClient;
  readonly auth: TAuth;
  readonly rules: readonly Rule<TAuth>[];
  /** Optional anticipated batch for before-phase UX checks (inside the txn). */
  readonly beforeBatch?: UploadBatch;
  readonly fn: (tx: SqlClient) => Promise<T>;
};

/**
 * Local write wrapper: optional before rules → caller's plain SQL → after rules
 * against the `ps_crud` delta. Violations throw `RulesReject` and roll back
 * data + queue together.
 */
export async function validatedWrite<T, TAuth extends RulesAuth = RulesAuth>(
  options: ValidatedWriteOptions<T, TAuth>
): Promise<T> {
  const { sql: client, auth, rules, beforeBatch, fn } = options;
  return client.transaction(async (tx) => {
    if (beforeBatch !== undefined && beforeBatch.rows.length > 0) {
      await runRules(
        { phase: 'before', auth, batch: beforeBatch, db: tx },
        rules
      );
    }
    const watermark = await readPsCrudMaxId(tx);
    const result = await fn(tx);
    const batch = await readUploadBatchSinceWatermark(tx, watermark);
    if (batch.rows.length > 0) {
      await runRules({ phase: 'after', auth, batch, db: tx }, rules);
    }
    return result;
  });
}
