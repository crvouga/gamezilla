import { assert } from '@pkgs/assert';

import {
  compileFrom,
  compileGroupBy,
  compileJoins,
  compileLimitOffset,
  compileOrderBy,
  compileReturning,
  compileSelectList,
} from './honey-clauses';
import { compileExpr, wireCompileQuery } from './honey-expr';
import { columnIdent } from './honey-ident';
import type { ColRef, Query, Scalar } from './honey-types';
import { HONEY_LIST_SEP } from './honey-list-sep';
import sql, { bulk, empty, ident, join, type Sql } from './sql';

/**
 * Compiles a honey {@link Query} map to a nested {@link Sql} fragment.
 */
export function compileQuery(q: Query): Sql {
  assertQueryObject(q);
  if (q.insertInto !== undefined) {
    return compileInsert(q);
  }
  if (q.update !== undefined) {
    return compileUpdate(q);
  }
  if (q.deleteFrom !== undefined) {
    return compileDelete(q);
  }
  return compileSelect(q);
}

function assertQueryObject(q: Query): void {
  assert.ok(
    q !== null && typeof q === 'object' && !Array.isArray(q),
    'honey: query must be an object',
    { q }
  );
}

wireCompileQuery(compileQuery);

function compileSelect(q: Query): Sql {
  const head = q.distinct
    ? sql`SELECT DISTINCT ${compileSelectList(q.select)}`
    : sql`SELECT ${compileSelectList(q.select)}`;

  const from = q.from !== undefined ? sql` FROM ${compileFrom(q.from)}` : empty;

  return sql`${head}${from}${compileJoins('JOIN', q.join)}${compileJoins(
    'LEFT JOIN',
    q.leftJoin
  )}${compileJoins('RIGHT JOIN', q.rightJoin)}${compileWhere(
    q.where
  )}${compileGroupBy(q.groupBy)}${compileHaving(q.having)}${compileOrderBy(
    q.orderBy
  )}${compileLimitOffset(q.limit, q.offset)}`;
}

function compileWhere(where: Query['where']): Sql {
  if (where === undefined) {
    return empty;
  }
  return sql` WHERE ${compileExpr(where)}`;
}

function compileHaving(having: Query['having']): Sql {
  if (having === undefined) {
    return empty;
  }
  return sql` HAVING ${compileExpr(having)}`;
}

function compileInsert(q: Query): Sql {
  assert.string(q.insertInto, 'honey: insertInto requires a table name');
  const rows = normalizeInsertRows(q.values);
  assert.ok(rows.length > 0, 'honey: insertInto requires values');
  const first = rows[0];
  assert.defined(first, 'honey: insertInto requires values');
  const cols = Object.keys(first);
  assert.ok(cols.length > 0, 'honey: insert row has no columns');

  const colSql = join(
    cols.map((c) => ident(c)),
    HONEY_LIST_SEP
  );
  const data = rows.map((row, rowIndex) =>
    cols.map((c) => {
      assert.ok(c in row, 'honey: row missing column', { c, rowIndex });
      return compileExpr(row[c as keyof typeof row]);
    })
  );

  return sql`INSERT INTO ${ident(q.insertInto)} (${colSql}) VALUES ${bulk(
    data,
    HONEY_LIST_SEP
  )}${compileReturning(q.returning)}`;
}

type InsertRow = Readonly<Record<string, Scalar | ColRef>>;

function normalizeInsertRows(values: Query['values']): readonly InsertRow[] {
  if (values === undefined) {
    return [];
  }
  if (Array.isArray(values)) {
    return values as readonly InsertRow[];
  }
  return [values as InsertRow];
}

function compileUpdate(q: Query): Sql {
  assert.string(q.update, 'honey: update requires a table name');
  assert.defined(q.set, 'honey: update requires set');
  const entries = Object.entries(q.set);
  assert.ok(entries.length > 0, 'honey: update requires set');

  const sets = join(
    entries.map(([c, v]) => sql`${columnIdent(c)} = ${compileExpr(v)}`),
    HONEY_LIST_SEP
  );

  return sql`UPDATE ${ident(q.update)} SET ${sets}${compileWhere(
    q.where
  )}${compileReturning(q.returning)}`;
}

function compileDelete(q: Query): Sql {
  assert.string(q.deleteFrom, 'honey: deleteFrom requires a table name');
  return sql`DELETE FROM ${ident(q.deleteFrom)}${compileWhere(
    q.where
  )}${compileReturning(q.returning)}`;
}
