import { assert } from '@pkgs/assert';

import {
  compileFrom,
  compileGroupBy,
  compileHaving,
  compileJoins,
  compileLimitOffset,
  compileOrderBy,
  compileReturning,
  compileSelectList,
  compileWhere,
} from './sql-map-clauses';
import { compileOnConflict } from './sql-map-conflict';
import { compileExpr, wireCompileQuery } from './sql-map-expr';
import { columnIdent } from './sql-map-ident';
import type { InsertValue, Query } from './sql-map-types';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';
import { compileForUpdate, compileUnion, compileWith } from './sql-map-with';
import sql, { bulk, empty, ident, join, type Sql } from '@pkgs/sql';

/**
 * Compiles a sql-map {@link Query} to a nested {@link Sql} fragment.
 */
export function compileQuery(q: Query): Sql {
  assertQueryObject(q);
  if (q.union !== undefined || q.unionAll !== undefined) {
    return compileCompound(q);
  }
  const preamble = compileWith(q.with);
  if (q.insertInto !== undefined) {
    return sql<void>`${preamble}${compileInsert(q)}`;
  }
  if (q.update !== undefined) {
    return sql<void>`${preamble}${compileUpdate(q)}`;
  }
  if (q.deleteFrom !== undefined) {
    return sql<void>`${preamble}${compileDelete(q)}`;
  }
  return sql<void>`${preamble}${compileSelect(q)}`;
}

function assertQueryObject(q: Query): void {
  assert.ok(
    q !== null && typeof q === 'object' && !Array.isArray(q),
    'sqlMap: query must be an object',
    { q }
  );
}

wireCompileQuery(compileQuery);

function compileCompound(q: Query): Sql {
  assert.ok(
    !(q.union !== undefined && q.unionAll !== undefined),
    'sqlMap: cannot mix union and unionAll'
  );
  assert.ok(
    q.insertInto === undefined &&
      q.update === undefined &&
      q.deleteFrom === undefined,
    'sqlMap: union cannot mix with DML'
  );
  const preamble = compileWith(q.with);
  const body =
    q.unionAll !== undefined
      ? compileUnion('UNION ALL', q.unionAll)
      : compileUnion('UNION', q.union);
  return sql<void>`${preamble}${body}${compileLimitOffset(q.limit, q.offset)}`;
}

function compileSelect(q: Query): Sql {
  const head = q.distinct
    ? sql<void>`SELECT DISTINCT ${compileSelectList(q.select)}`
    : sql<void>`SELECT ${compileSelectList(q.select)}`;

  const from =
    q.from !== undefined ? sql<void>` FROM ${compileFrom(q.from)}` : empty;

  return sql<void>`${head}${from}${compileJoins('JOIN', q.join)}${compileJoins(
    'LEFT JOIN',
    q.leftJoin
  )}${compileJoins('RIGHT JOIN', q.rightJoin)}${compileWhere(
    q.where
  )}${compileGroupBy(q.groupBy)}${compileHaving(q.having)}${compileOrderBy(
    q.orderBy
  )}${compileLimitOffset(q.limit, q.offset)}${compileForUpdate(
    q.forUpdate,
    q.skipLocked
  )}`;
}

function compileInsert(q: Query): Sql {
  assert.string(q.insertInto, 'sqlMap: insertInto requires a table name');
  if (q.values !== undefined) {
    return compileInsertValues(q);
  }
  assert.ok(
    q.select !== undefined,
    'sqlMap: insertInto requires values or select'
  );
  return compileInsertSelect(q);
}

function compileInsertValues(q: Query): Sql {
  assert.string(q.insertInto, 'sqlMap: insertInto requires a table name');
  assert.ok(
    q.columns === undefined,
    'sqlMap: insert values cannot include columns'
  );
  const rows = normalizeInsertRows(q.values);
  assert.ok(rows.length > 0, 'sqlMap: insertInto requires values');
  const first = rows[0];
  assert.defined(first, 'sqlMap: insertInto requires values');
  const cols = Object.keys(first);
  assert.ok(cols.length > 0, 'sqlMap: insert row has no columns');

  const colSql = join(
    cols.map((c) => ident(c)),
    SQL_MAP_LIST_SEP
  );
  const data = rows.map((row, rowIndex) =>
    cols.map((c) => {
      assert.ok(c in row, 'sqlMap: row missing column', { c, rowIndex });
      return compileExpr(row[c as keyof typeof row]);
    })
  );

  return sql<void>`INSERT INTO ${ident(q.insertInto)} (${colSql}) VALUES ${bulk(
    data,
    SQL_MAP_LIST_SEP
  )}${compileOnConflict(q.onConflict)}${compileReturning(q.returning)}`;
}

function compileInsertSelect(q: Query): Sql {
  assert.string(q.insertInto, 'sqlMap: insertInto requires a table name');
  const cols = q.columns;
  assert.ok(
    Array.isArray(cols) && cols.length > 0,
    'sqlMap: insert…select requires columns'
  );
  assert.defined(q.select, 'sqlMap: insert…select requires select');
  const colSql = join(
    cols.map((c) => ident(c)),
    SQL_MAP_LIST_SEP
  );
  return sql<void>`INSERT INTO ${ident(q.insertInto)} (${colSql}) ${compileSelect(
    selectBodyFromInsert(q)
  )}${compileOnConflict(q.onConflict)}${compileReturning(q.returning)}`;
}

function selectBodyFromInsert(q: Query): Query {
  assert.defined(q.select, 'sqlMap: insert…select requires select');
  const body: {
    -readonly [K in keyof Query]?: Query[K];
  } = { select: q.select };
  copyIfDefined(body, q, 'distinct');
  copyIfDefined(body, q, 'from');
  copyIfDefined(body, q, 'join');
  copyIfDefined(body, q, 'leftJoin');
  copyIfDefined(body, q, 'rightJoin');
  copyIfDefined(body, q, 'where');
  copyIfDefined(body, q, 'groupBy');
  copyIfDefined(body, q, 'having');
  copyIfDefined(body, q, 'orderBy');
  copyIfDefined(body, q, 'limit');
  copyIfDefined(body, q, 'offset');
  return body;
}

function copyIfDefined<K extends keyof Query>(
  dest: { -readonly [P in K]?: Query[P] },
  src: Query,
  key: K
): void {
  const v = src[key];
  if (v !== undefined) {
    dest[key] = v;
  }
}

type InsertRow = Readonly<Record<string, InsertValue>>;

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
  assert.string(q.update, 'sqlMap: update requires a table name');
  assert.defined(q.set, 'sqlMap: update requires set');
  const entries = Object.entries(q.set);
  assert.ok(entries.length > 0, 'sqlMap: update requires set');

  const sets = join(
    entries.map(([c, v]) => sql<void>`${columnIdent(c)} = ${compileExpr(v)}`),
    SQL_MAP_LIST_SEP
  );

  return sql<void>`UPDATE ${ident(q.update)} SET ${sets}${compileWhere(
    q.where
  )}${compileReturning(q.returning)}`;
}

function compileDelete(q: Query): Sql {
  const target = q.deleteFrom;
  assert.defined(target, 'sqlMap: deleteFrom required');
  if (typeof target === 'string') {
    return sql<void>`DELETE FROM ${ident(target)}${compileWhere(
      q.where
    )}${compileReturning(q.returning)}`;
  }
  assert.equals(
    target.length,
    2,
    'sqlMap: deleteFrom alias needs [table, alias]'
  );
  const [table, alias] = target;
  assert.string(table, 'sqlMap: deleteFrom table must be a string');
  assert.string(alias, 'sqlMap: deleteFrom alias must be a string');
  return sql<void>`DELETE FROM ${ident(table)} AS ${ident(alias)}${compileWhere(
    q.where
  )}${compileReturning(q.returning)}`;
}
