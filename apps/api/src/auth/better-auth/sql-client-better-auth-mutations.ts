import type { CleanedWhere } from '@better-auth/core/db/adapter';
import { BetterAuthError } from '@better-auth/core/error';

import {
  buildWhere,
  qCol,
  qIdent,
  rowToCamel,
} from './sql-client-better-auth-where';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

export async function betterAuthSqlCreate<T extends Record<string, unknown>>(
  sql: SqlClient,
  args: {
    model: string;
    data: T;
    select?: string[] | undefined;
  }
): Promise<T> {
  const { model, data, select: _select } = args;
  void _select;
  const table = qIdent(model);
  const keys = Object.keys(data);
  if (keys.length === 0) {
    throw new BetterAuthError('[SqlClient adapter] create: empty data object');
  }
  const cols = keys.map((k) => qCol(k)).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map((k) => data[k]);
  const insertSql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;
  await sql.run(insertSql, values);
  const id = data['id'];
  if (id === undefined || id === null) {
    throw new BetterAuthError(
      '[SqlClient adapter] create: missing id after insert'
    );
  }
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${qCol('id')} = ? LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) {
    throw new BetterAuthError(
      '[SqlClient adapter] create: row not found after insert'
    );
  }
  return rowToCamel(row) as T;
}

export async function betterAuthSqlUpdate<T>(
  sql: SqlClient,
  args: {
    model: string;
    where: CleanedWhere[];
    update: T;
  }
): Promise<T | null> {
  const { model, where, update: patch } = args;
  const table = qIdent(model);
  const patchRec = patch as Record<string, unknown>;
  const setKeys = Object.keys(patchRec);
  if (setKeys.length === 0) {
    const params: unknown[] = [];
    const whereSql = `WHERE ${buildWhere(where, params)}`;
    const rows = await sql.query<Record<string, unknown>>(
      `SELECT * FROM ${table} ${whereSql} LIMIT 1`,
      params
    );
    const r0 = rows[0];
    return r0 === undefined ? null : (rowToCamel(r0) as T);
  }
  const setParams: unknown[] = [];
  const setClause = setKeys
    .map((k) => {
      setParams.push(patchRec[k]);
      return `${qCol(k)} = ?`;
    })
    .join(', ');
  const whereParams: unknown[] = [];
  const whereSql = `WHERE ${buildWhere(where, whereParams)}`;
  const rows = await sql.query<Record<string, unknown>>(
    `UPDATE ${table} SET ${setClause} ${whereSql} RETURNING *`,
    [...setParams, ...whereParams]
  );
  const r0 = rows[0];
  return r0 === undefined ? null : (rowToCamel(r0) as T);
}

export async function betterAuthSqlUpdateMany(
  sql: SqlClient,
  args: {
    model: string;
    where: CleanedWhere[];
    update: Record<string, unknown>;
  }
): Promise<number> {
  const { model, where, update: patch } = args;
  const table = qIdent(model);
  const setKeys = Object.keys(patch);
  if (setKeys.length === 0) return 0;
  const setParams: unknown[] = [];
  const setClause = setKeys
    .map((k) => {
      setParams.push(patch[k]);
      return `${qCol(k)} = ?`;
    })
    .join(', ');
  const whereParams: unknown[] = [];
  const whereSql = `WHERE ${buildWhere(where, whereParams)}`;
  const res = await sql.run(`UPDATE ${table} SET ${setClause} ${whereSql}`, [
    ...setParams,
    ...whereParams,
  ]);
  return res.changes;
}

export async function betterAuthSqlDelete(
  sql: SqlClient,
  args: { model: string; where: CleanedWhere[] }
): Promise<void> {
  const { model, where } = args;
  const table = qIdent(model);
  const params: unknown[] = [];
  const whereSql = `WHERE ${buildWhere(where, params)}`;
  await sql.run(`DELETE FROM ${table} ${whereSql}`, params);
}

export async function betterAuthSqlDeleteMany(
  sql: SqlClient,
  args: { model: string; where: CleanedWhere[] }
): Promise<number> {
  const { model, where } = args;
  const table = qIdent(model);
  const params: unknown[] = [];
  const whereSql = `WHERE ${buildWhere(where, params)}`;
  const res = await sql.run(`DELETE FROM ${table} ${whereSql}`, params);
  return res.changes;
}
