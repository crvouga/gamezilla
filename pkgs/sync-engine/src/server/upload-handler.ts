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

/**
 * Table and column names arrive from the (authenticated) client and are
 * interpolated into SQL text — bind parameters cannot stand in for
 * identifiers. Values are always parameterized, but a hostile column key such
 * as `x = 1; DROP TABLE profiles; --` would be a stacked-query injection if
 * spliced in raw. Restrict identifiers to a conservative snake/camel-case
 * shape (which every real sync table + column already satisfies) and quote
 * them so the interpolation is unambiguous on both Postgres and SQLite.
 */
const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Throws a plain `Error` (not an `assert` crash) so a hostile identifier is
 * turned into a per-row rejection by {@link applyUploadRow} rather than
 * exiting the worker process.
 */
function quoteSqlIdentifier(name: string): string {
  if (!SQL_IDENTIFIER.test(name)) {
    throw new Error(`invalid SQL identifier in upload row: ${name}`);
  }
  return `"${name}"`;
}

export async function applyPut(sql: SqlClient, row: UploadRow): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  // Empty put/patch is a no-op (client may upload username-only profile
  // patches that the API strips to {}). Do not assert — that crashes the
  // worker and leaves the PowerSync CRUD queue stuck retrying.
  if (columns.length === 0) return;
  const table = quoteSqlIdentifier(row.table);
  const quotedColumns = columns.map(quoteSqlIdentifier);
  const placeholders = columns.map(() => '?').join(', ');
  const sqlText = `INSERT INTO ${table} (${quotedColumns.join(', ')}) VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${quotedColumns.map((c) => `${c} = excluded.${c}`).join(', ')}`;
  await sql.run(
    sqlText,
    columns.map((c) => values[c])
  );
}

export async function applyPatch(
  sql: SqlClient,
  row: UploadRow
): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  if (columns.length === 0) return;
  const table = quoteSqlIdentifier(row.table);
  const sets = columns.map((c) => `${quoteSqlIdentifier(c)} = ?`).join(', ');
  await sql.run(`UPDATE ${table} SET ${sets} WHERE id = ?`, [
    ...columns.map((c) => values[c]),
    row.id,
  ]);
}

export async function applyDelete(
  sql: SqlClient,
  row: UploadRow
): Promise<void> {
  await sql.run(`DELETE FROM ${quoteSqlIdentifier(row.table)} WHERE id = ?`, [
    row.id,
  ]);
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
      const out = await processUploadBatch(
        sql,
        ctx,
        options.evaluateRow,
        batch
      );
      return c.json(out, 200);
    } finally {
      await sql.disconnect();
    }
  };
}
