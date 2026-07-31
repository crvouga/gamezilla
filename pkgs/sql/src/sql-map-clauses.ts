import { assert } from '@pkgs/assert';

import { compileExpr, isOpOrFnHead, isQuery } from './sql-map-expr';
import { columnIdent } from './sql-map-ident';
import { compileOrderBy } from './sql-map-order';
import { isSqlMapCastType } from './sql-map-registry';
import type {
  JoinSpec,
  OpCall,
  Query,
  SelectItem,
  TableRef,
} from './sql-map-types';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';
import sql, { empty, join, raw, type Sql } from './sql';

export { compileOrderBy };

export function tableRef(t: TableRef): Sql {
  if (typeof t === 'string') {
    return columnIdent(t);
  }
  assert.ok(
    t.length === 2 || t.length === 3,
    'sqlMap: table alias needs [src, alias] or [src, alias, colDefs]',
    { length: t.length }
  );
  const [src, alias] = t;
  assert.string(alias, 'sqlMap: table alias must be a string', { alias });
  const base = compileTableSrc(src);
  const colDefs = t.length === 3 ? t[2] : undefined;
  if (colDefs === undefined) {
    return sql`${base} AS ${columnIdent(alias)}`;
  }
  assert.ok(colDefs.length > 0, 'sqlMap: empty table col defs');
  const defs = join(
    colDefs.map(([c, typ]) => {
      assert.string(c, 'sqlMap: col def name must be a string');
      assert.string(typ, 'sqlMap: col def type must be a string');
      assert.ok(isSqlMapCastType(typ), 'sqlMap: unknown col def type', { typ });
      return sql`${columnIdent(c)} ${raw(typ.toLowerCase())}`;
    }),
    SQL_MAP_LIST_SEP
  );
  return sql`${base} AS ${columnIdent(alias)} (${defs})`;
}

function compileTableSrc(src: string | Query | OpCall): Sql {
  if (typeof src === 'string') {
    return columnIdent(src);
  }
  // Query map or OpCall (TVF) — compileExpr parenthesizes queries; TVF OpCalls
  // emit `FN(...)` without wrapping.
  if (isQuery(src)) {
    return compileExpr(src);
  }
  return compileExpr(src);
}

export function selectItem(s: SelectItem): Sql {
  if (typeof s === 'string') {
    return columnIdent(s);
  }
  if (isAliasedSelectPair(s)) {
    const [thing, alias] = s;
    const inner =
      typeof thing === 'string' ? columnIdent(thing) : compileExpr(thing, true);
    return sql`${inner} AS ${columnIdent(alias)}`;
  }
  return compileExpr(s, true);
}

function isAliasedSelectPair(
  s: SelectItem
): s is readonly [string | OpCall | Query, string] {
  return (
    Array.isArray(s) &&
    s.length === 2 &&
    typeof s[1] === 'string' &&
    !isOpOrFnHead(s[0])
  );
}

export function compileJoins(
  kind: string,
  spec: JoinSpec | readonly JoinSpec[] | undefined
): Sql {
  if (!spec) {
    return empty;
  }
  const specs = normalizeJoinSpecs(spec);
  return join(
    specs.map(
      ([t, on]) => sql` ${raw(kind)} ${tableRef(t)} ON ${compileExpr(on)}`
    ),
    ''
  );
}

function normalizeJoinSpecs(
  spec: JoinSpec | readonly JoinSpec[]
): readonly JoinSpec[] {
  if (isJoinSpec(spec)) {
    return [spec];
  }
  return spec;
}

function isJoinSpec(x: JoinSpec | readonly JoinSpec[]): x is JoinSpec {
  return (
    x.length === 2 &&
    (typeof x[0] === 'string' ||
      (Array.isArray(x[0]) &&
        typeof x[0][1] === 'string' &&
        !Array.isArray(x[0][1])))
  );
}

export function compileFrom(f: TableRef | readonly TableRef[]): Sql {
  if (Array.isArray(f) && !isSingleAliasPair(f)) {
    return join(
      (f as readonly TableRef[]).map((t) => tableRef(t)),
      SQL_MAP_LIST_SEP
    );
  }
  return tableRef(f as TableRef);
}

function isSingleAliasPair(f: readonly unknown[]): boolean {
  return (
    (f.length === 2 || f.length === 3) &&
    typeof f[1] === 'string' &&
    (typeof f[0] === 'string' || isQuery(f[0]) || Array.isArray(f[0]))
  );
}

export function compileSelectList(
  select: readonly SelectItem[] | undefined
): Sql {
  if (!select || select.length === 0) {
    return raw('*');
  }
  return join(
    select.map((s) => selectItem(s)),
    SQL_MAP_LIST_SEP
  );
}

export function compileGroupBy(cols: readonly string[] | undefined): Sql {
  if (!cols || cols.length === 0) {
    return empty;
  }
  return sql` GROUP BY ${join(
    cols.map((c) => columnIdent(c)),
    SQL_MAP_LIST_SEP
  )}`;
}

export function compileLimitOffset(
  limit: number | undefined,
  offset: number | undefined
): Sql {
  let out: Sql = empty;
  if (limit !== undefined) {
    out = sql`${out} LIMIT ${assertNonNegInt(limit, 'limit')}`;
  }
  if (offset !== undefined) {
    out = sql`${out} OFFSET ${assertNonNegInt(offset, 'offset')}`;
  }
  return out;
}

function assertNonNegInt(n: number, what: string): number {
  assert.integer(n, `sqlMap: ${what} must be a non-negative integer`);
  assert.nonNegative(n, `sqlMap: ${what} must be a non-negative integer`);
  return n;
}

export function compileReturning(cols: readonly string[] | undefined): Sql {
  if (!cols || cols.length === 0) {
    return empty;
  }
  return sql` RETURNING ${join(
    cols.map((c) => columnIdent(c)),
    SQL_MAP_LIST_SEP
  )}`;
}

export function compileWhere(where: Query['where']): Sql {
  if (where === undefined) {
    return empty;
  }
  return sql` WHERE ${compileExpr(where)}`;
}

export function compileHaving(having: Query['having']): Sql {
  if (having === undefined) {
    return empty;
  }
  return sql` HAVING ${compileExpr(having)}`;
}
