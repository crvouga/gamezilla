import { assert } from '@pkgs/assert';

import { compileExpr, isOpOrFnHead, isQuery } from './honey-expr';
import { columnIdent } from './honey-ident';
import type {
  JoinSpec,
  OpCall,
  OrderItem,
  Query,
  SelectItem,
  TableRef,
} from './honey-types';
import { HONEY_LIST_SEP } from './honey-list-sep';
import sql, { empty, join, raw, type Sql } from './sql';

export function tableRef(t: TableRef): Sql {
  if (typeof t === 'string') {
    return columnIdent(t);
  }
  assert.equals(t.length, 2, 'honey: table alias pair needs [src, alias]', {
    length: t.length,
  });
  const [src, alias] = t;
  assert.string(alias, 'honey: table alias must be a string', { alias });
  const base = typeof src === 'string' ? columnIdent(src) : compileExpr(src);
  return sql`${base} AS ${columnIdent(alias)}`;
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
      HONEY_LIST_SEP
    );
  }
  return tableRef(f as TableRef);
}

function isSingleAliasPair(f: readonly unknown[]): boolean {
  return (
    f.length === 2 &&
    typeof f[1] === 'string' &&
    (typeof f[0] === 'string' || isQuery(f[0]))
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
    HONEY_LIST_SEP
  );
}

export function compileGroupBy(cols: readonly string[] | undefined): Sql {
  if (!cols || cols.length === 0) {
    return empty;
  }
  return sql` GROUP BY ${join(
    cols.map((c) => columnIdent(c)),
    HONEY_LIST_SEP
  )}`;
}

export function compileOrderBy(items: readonly OrderItem[] | undefined): Sql {
  if (!items || items.length === 0) {
    return empty;
  }
  return sql` ORDER BY ${join(
    items.map((o) => orderItem(o)),
    HONEY_LIST_SEP
  )}`;
}

function orderItem(o: OrderItem): Sql {
  if (typeof o === 'string') {
    return columnIdent(o);
  }
  assert.equals(o.length, 2, 'honey: order item needs [col, dir]', {
    length: o.length,
  });
  const [col, dir] = o;
  assert.string(col, 'honey: order column must be a string', { col });
  assert.enum(dir, ['asc', 'desc'], 'honey: bad sort dir');
  return sql`${columnIdent(col)} ${raw(dir.toUpperCase())}`;
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
  assert.integer(n, `honey: ${what} must be a non-negative integer`);
  assert.nonNegative(n, `honey: ${what} must be a non-negative integer`);
  return n;
}

export function compileReturning(cols: readonly string[] | undefined): Sql {
  if (!cols || cols.length === 0) {
    return empty;
  }
  return sql` RETURNING ${join(
    cols.map((c) => columnIdent(c)),
    HONEY_LIST_SEP
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
