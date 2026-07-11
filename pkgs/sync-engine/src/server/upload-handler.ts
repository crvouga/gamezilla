import { assert } from '@pkgs/assert';
import type { Context } from 'hono';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  UploadBatch,
  UploadBatchResult,
  UploadRow,
  UploadRowResult,
} from '../shared/upload-batch';

export type UploadRowEvaluator<TCtx> = (
  ctx: TCtx,
  row: UploadRow,
  sql: SqlClient
) => Promise<UploadRowResult>;

export type UploadHandlerOptions<TAuth, TCtx> = {
  readonly resolveAuth: (c: Context) => Promise<TAuth | null>;
  readonly mapAuth: (auth: TAuth) => TCtx;
  readonly evaluateRow: UploadRowEvaluator<TCtx>;
  readonly openSql: () => Promise<SqlClient>;
};

export async function applyPut(sql: SqlClient, row: UploadRow): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  assert.ok(columns.length > 0, 'upload put requires values', { row });
  const placeholders = columns.map(() => '?').join(', ');
  const sqlText = `INSERT INTO ${row.table} (${columns.join(', ')}) VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${columns.map((c) => `${c} = excluded.${c}`).join(', ')}`;
  await sql.run(
    sqlText,
    columns.map((c) => values[c])
  );
}

export async function applyPatch(sql: SqlClient, row: UploadRow): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  assert.ok(columns.length > 0, 'upload patch requires values', { row });
  const sets = columns.map((c) => `${c} = ?`).join(', ');
  await sql.run(`UPDATE ${row.table} SET ${sets} WHERE id = ?`, [
    ...columns.map((c) => values[c]),
    row.id,
  ]);
}

export async function applyDelete(sql: SqlClient, row: UploadRow): Promise<void> {
  await sql.run(`DELETE FROM ${row.table} WHERE id = ?`, [row.id]);
}

export async function applyRow(sql: SqlClient, row: UploadRow): Promise<void> {
  if (row.op === 'put') {
    await applyPut(sql, row);
    return;
  }
  if (row.op === 'patch') {
    await applyPatch(sql, row);
    return;
  }
  await applyDelete(sql, row);
}

function parseUploadRow(item: unknown): UploadRow {
  assert.record(item, 'upload row must be object');
  const op = item['op'];
  assert.ok(op === 'put' || op === 'patch' || op === 'delete', 'invalid op');
  const table = item['table'];
  assert.string(table, 'table required');
  const id = item['id'];
  assert.string(id, 'id required');
  const values = item['values'];
  if (values !== undefined) {
    assert.record(values, 'values must be object when present');
  }
  return {
    op,
    table,
    id,
    ...(values !== undefined ? { values } : {}),
  };
}

export function parseUploadBody(bodyRaw: unknown): UploadBatch {
  assert.record(bodyRaw, 'upload body must be object');
  const rowsRaw = bodyRaw['rows'];
  assert.array(rowsRaw, 'upload rows required');
  assert.ok(rowsRaw.length > 0, 'upload rows must not be empty');
  return { rows: rowsRaw.map(parseUploadRow) };
}

async function applyUploadRow<TCtx>(
  sql: SqlClient,
  ctx: TCtx,
  evaluateRow: UploadRowEvaluator<TCtx>,
  row: UploadRow
): Promise<UploadRowResult> {
  const decision = await evaluateRow(ctx, row, sql);
  if (decision.status === 'rejected') {
    return decision;
  }
  try {
    await applyRow(sql, row);
    return { status: 'accepted' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: 'rejected', reason: message };
  }
}

export async function processUploadBatch<TCtx>(
  sql: SqlClient,
  ctx: TCtx,
  evaluateRow: UploadRowEvaluator<TCtx>,
  batch: UploadBatch
): Promise<UploadBatchResult> {
  const results: UploadRowResult[] = [];
  for (const row of batch.rows) {
    results.push(await applyUploadRow(sql, ctx, evaluateRow, row));
  }
  return { results };
}

export function createUploadHandler<TAuth, TCtx>(
  options: UploadHandlerOptions<TAuth, TCtx>
) {
  return async (c: Context): Promise<Response> => {
    const auth = await options.resolveAuth(c);
    if (auth === null) {
      return c.json({ error: 'unauthorized' }, 401);
    }

    const batch = parseUploadBody(await c.req.json());
    const ctx = options.mapAuth(auth);
    const sql = await options.openSql();
    try {
      await sql.connect();
      const out = await processUploadBatch(sql, ctx, options.evaluateRow, batch);
      return c.json(out, 200);
    } finally {
      await sql.disconnect();
    }
  };
}
