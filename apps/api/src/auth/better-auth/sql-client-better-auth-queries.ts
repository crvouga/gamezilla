import type { CleanedWhere, JoinConfig } from '@better-auth/core/db/adapter';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

import { assertNoJoin } from './sql-client-better-auth-shared';
import {
  buildWhere,
  qCol,
  qIdent,
  rowToCamel,
} from './sql-client-better-auth-where';

type GetFieldName = (args: { model: string; field: string }) => string;

export async function betterAuthSqlFindOne<T>(
  sql: SqlClient,
  getFieldName: GetFieldName,
  args: {
    model: string;
    where: CleanedWhere[];
    select?: string[] | undefined;
    join?: JoinConfig | undefined;
  }
): Promise<T | null> {
  const { model, where, select, join } = args;
  assertNoJoin(join, 'findOne');
  const table = qIdent(model);
  const params: unknown[] = [];
  const whereSql = where.length > 0 ? `WHERE ${buildWhere(where, params)}` : '';
  const projection = select?.length
    ? select.map((f) => qCol(getFieldName({ model, field: f }))).join(', ')
    : '*';
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT ${projection} FROM ${table} ${whereSql} LIMIT 1`,
    params
  );
  const r0 = rows[0];
  return r0 === undefined ? null : (rowToCamel(r0) as T);
}

export async function betterAuthSqlFindMany<T>(
  sql: SqlClient,
  getFieldName: GetFieldName,
  args: {
    model: string;
    where?: CleanedWhere[] | undefined;
    limit: number;
    select?: string[] | undefined;
    sortBy?: { field: string; direction: 'asc' | 'desc' } | undefined;
    offset?: number | undefined;
    join?: JoinConfig | undefined;
  }
): Promise<T[]> {
  const { model, where, limit, select, sortBy, offset, join } = args;
  assertNoJoin(join, 'findMany');
  const table = qIdent(model);
  const params: unknown[] = [];
  const whereSql = where?.length ? `WHERE ${buildWhere(where, params)}` : '';
  const projection = select?.length
    ? select.map((f) => qCol(getFieldName({ model, field: f }))).join(', ')
    : '*';
  const orderSql = sortBy?.field
    ? `ORDER BY ${qCol(getFieldName({ model, field: sortBy.field }))} ${sortBy.direction === 'desc' ? 'DESC' : 'ASC'}`
    : '';
  const limitSql = `LIMIT ${Math.max(0, Math.floor(limit))}`;
  const offsetSql =
    offset !== undefined && offset > 0 ? `OFFSET ${Math.floor(offset)}` : '';
  const chunks = [
    `SELECT ${projection} FROM ${table}`,
    whereSql,
    orderSql,
    limitSql,
    offsetSql,
  ].filter(Boolean);
  const rows = await sql.query<Record<string, unknown>>(
    chunks.join(' '),
    params
  );
  return rows.map((r) => rowToCamel(r) as T);
}

export async function betterAuthSqlCount(
  sql: SqlClient,
  args: {
    model: string;
    where?: CleanedWhere[] | undefined;
  }
): Promise<number> {
  const { model, where } = args;
  const table = qIdent(model);
  const params: unknown[] = [];
  const whereSql = where?.length ? `WHERE ${buildWhere(where, params)}` : '';
  const rows = await sql.query<{ c: unknown }>(
    `SELECT COUNT(*)::bigint AS c FROM ${table} ${whereSql}`,
    params
  );
  const raw = rows[0]?.c;
  if (typeof raw === 'bigint') return Number(raw);
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return Number(raw);
  return 0;
}
