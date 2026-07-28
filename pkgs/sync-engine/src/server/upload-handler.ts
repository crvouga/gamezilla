import { assert } from '@pkgs/assert';
import { join, raw, sql, type Value } from '@pkgs/sql';
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
  db: SqlClient
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

export async function applyPut(db: SqlClient, row: UploadRow): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  // Empty put/patch is a no-op (client may upload username-only profile
  // patches that the API strips to {}). Do not assert — that crashes the
  // worker and leaves the PowerSync CRUD queue stuck retrying.
  if (columns.length === 0) return;
  const table = quoteSqlIdentifier(row.table);
  const quotedColumns = columns.map(quoteSqlIdentifier);
  const conflictSet = quotedColumns
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');
  const boundValues = columns.map((c) => values[c] as Value);
  // honey: dynamic columns (client-supplied Object.keys drive the INSERT
  // column list + conflict set) and identifiers must reject-not-crash.
  await db.run(sql`
    INSERT INTO ${raw(table)} (${raw(quotedColumns.join(', '))})
    VALUES ${join(boundValues, ', ', '(', ')')}
    ON CONFLICT (id) DO UPDATE SET ${raw(conflictSet)}`);
}

export async function applyPatch(db: SqlClient, row: UploadRow): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  if (columns.length === 0) return;
  const table = quoteSqlIdentifier(row.table);
  const sets = join(
    columns.map(
      (c) => sql`${raw(quoteSqlIdentifier(c))} = ${values[c] as Value}`
    )
  );
  // honey: dynamic columns (client-supplied) + reject-not-crash identifiers.
  await db.run(sql`UPDATE ${raw(table)} SET ${sets} WHERE id = ${row.id}`);
}

export async function applyDelete(
  db: SqlClient,
  row: UploadRow
): Promise<void> {
  // honey: dynamic identifier — hostile table names must reject-not-crash
  // (honey's ident() asserts and would exit the worker process).
  await db.run(
    sql`DELETE FROM ${raw(quoteSqlIdentifier(row.table))} WHERE id = ${row.id}`
  );
}

export async function applyRow(db: SqlClient, row: UploadRow): Promise<void> {
  if (row.op === 'put') {
    await applyPut(db, row);
    return;
  }
  if (row.op === 'patch') {
    await applyPatch(db, row);
    return;
  }
  await applyDelete(db, row);
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
  db: SqlClient,
  ctx: TCtx,
  evaluateRow: UploadRowEvaluator<TCtx>,
  row: UploadRow
): Promise<UploadRowResult> {
  const decision = await evaluateRow(ctx, row, db);
  if (decision.status === 'rejected') {
    return decision;
  }
  try {
    await applyRow(db, row);
    return { status: 'accepted' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: 'rejected', reason: message };
  }
}

export async function processUploadBatch<TCtx>(
  db: SqlClient,
  ctx: TCtx,
  evaluateRow: UploadRowEvaluator<TCtx>,
  batch: UploadBatch
): Promise<UploadBatchResult> {
  const results: UploadRowResult[] = [];
  for (const row of batch.rows) {
    results.push(await applyUploadRow(db, ctx, evaluateRow, row));
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
    const db = await options.openSql();
    try {
      await db.connect();
      const out = await processUploadBatch(db, ctx, options.evaluateRow, batch);
      return c.json(out, 200);
    } finally {
      await db.disconnect();
    }
  };
}
