import { assert } from '@pkgs/assert';
import type { Context } from 'hono';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type {
  UploadBatch,
  UploadBatchResult,
  UploadRow,
  UploadRowResult,
} from '../shared/upload-batch';

export type WritePolicyContext = {
  /** PowerSync JWT `sub` — account id when signed in, else device id. */
  readonly subjectId: string;
  readonly isAnonymous: boolean;
  readonly deviceId: string;
  readonly accountId: string | null;
  /** Author id for ownership checks: accountId ?? deviceId. */
  readonly myId: string;
  readonly memberOfSpaceIds: readonly string[];
};

export type WritePolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

export type WritePolicy = (
  ctx: WritePolicyContext,
  row: UploadRow
) => WritePolicyDecision | Promise<WritePolicyDecision>;

export type WritePolicyRegistry = {
  get(table: string): WritePolicy | undefined;
};

export function createWritePolicyRegistry(
  policies: Readonly<Record<string, WritePolicy>>
): WritePolicyRegistry {
  return {
    get: (table) => policies[table],
  };
}

export type UploadHandlerOptions<TAuth> = {
  readonly resolveAuth: (c: Context) => Promise<TAuth | null>;
  readonly mapAuth: (auth: TAuth) => WritePolicyContext;
  readonly policies: WritePolicyRegistry;
  readonly openSql: () => Promise<SqlClient>;
};

async function applyPut(sql: SqlClient, row: UploadRow): Promise<void> {
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

async function applyPatch(sql: SqlClient, row: UploadRow): Promise<void> {
  const values = row.values ?? {};
  const columns = Object.keys(values);
  assert.ok(columns.length > 0, 'upload patch requires values', { row });
  const sets = columns.map((c) => `${c} = ?`).join(', ');
  await sql.run(`UPDATE ${row.table} SET ${sets} WHERE id = ?`, [
    ...columns.map((c) => values[c]),
    row.id,
  ]);
}

async function applyDelete(sql: SqlClient, row: UploadRow): Promise<void> {
  await sql.run(`DELETE FROM ${row.table} WHERE id = ?`, [row.id]);
}

async function applyRow(sql: SqlClient, row: UploadRow): Promise<void> {
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

async function evaluateRow(
  ctx: WritePolicyContext,
  policies: WritePolicyRegistry,
  row: UploadRow
): Promise<UploadRowResult> {
  const policy = policies.get(row.table);
  if (policy === undefined) {
    return { status: 'rejected', reason: `no write policy for ${row.table}` };
  }
  const decision = await policy(ctx, row);
  if (!decision.allowed) {
    return { status: 'rejected', reason: decision.reason };
  }
  return { status: 'accepted' };
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

function parseUploadBody(bodyRaw: unknown): UploadBatch {
  assert.record(bodyRaw, 'upload body must be object');
  const rowsRaw = bodyRaw['rows'];
  assert.array(rowsRaw, 'upload rows required');
  assert.ok(rowsRaw.length > 0, 'upload rows must not be empty');
  return { rows: rowsRaw.map(parseUploadRow) };
}

async function applyUploadRow(
  sql: SqlClient,
  ctx: WritePolicyContext,
  policies: WritePolicyRegistry,
  row: UploadRow
): Promise<UploadRowResult> {
  const decision = await evaluateRow(ctx, policies, row);
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

async function processUploadBatch(
  sql: SqlClient,
  ctx: WritePolicyContext,
  policies: WritePolicyRegistry,
  batch: UploadBatch
): Promise<UploadBatchResult> {
  const results: UploadRowResult[] = [];
  for (const row of batch.rows) {
    results.push(await applyUploadRow(sql, ctx, policies, row));
  }
  return { results };
}

export function createUploadHandler<TAuth>(
  options: UploadHandlerOptions<TAuth>
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
      const out = await processUploadBatch(sql, ctx, options.policies, batch);
      return c.json(out, 200);
    } finally {
      await sql.disconnect();
    }
  };
}
