import { assert } from '@pkgs/assert-root-shared/singleton';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql, { empty, join, raw } from '@pkgs/sql-root-shared/sql';
import { compileExpr, isOpOrFnHead } from './sql-map-expr';
import { columnIdent } from './sql-map-ident';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';
import { isSqlMapCollation } from './sql-map-registry';
import type { OrderItem, OrderOpts } from './sql-map-types';

export function compileOrderBy(items: readonly OrderItem[] | undefined): Sql {
  if (!items || items.length === 0) {
    return empty;
  }
  return sql<void>` ORDER BY ${join(
    items.map((o) => orderItem(o)),
    SQL_MAP_LIST_SEP
  )}`;
}

function orderItem(o: OrderItem): Sql {
  if (typeof o === 'string') {
    return columnIdent(o);
  }
  assert.ok(Array.isArray(o) && o.length >= 2, 'sqlMap: bad order item', { o });
  const expr = o[0];
  const dir = o[1];
  assert.enum(dir, ['asc', 'desc'], 'sqlMap: bad sort dir');
  const opts = readOrderOpts(o[2]);
  // SQLite requires COLLATE before ASC/DESC; Postgres accepts both orders.
  let out = compileOrderExpr(expr);
  if (opts?.collate !== undefined) {
    assert.ok(isSqlMapCollation(opts.collate), 'sqlMap: unknown collation', {
      collate: opts.collate,
    });
    out = sql<void>`${out} COLLATE ${raw(opts.collate.toUpperCase())}`;
  }
  out = sql<void>`${out} ${raw(dir.toUpperCase())}`;
  if (opts?.nulls !== undefined) {
    assert.enum(opts.nulls, ['first', 'last'], 'sqlMap: bad nulls');
    out = sql<void>`${out} NULLS ${raw(opts.nulls.toUpperCase())}`;
  }
  return out;
}

function readOrderOpts(opts: unknown): OrderOpts | undefined {
  if (opts === undefined) {
    return undefined;
  }
  assert.ok(
    typeof opts === 'object' &&
      opts !== null &&
      !Array.isArray(opts) &&
      !('col' in opts),
    'sqlMap: order opts must be an object',
    { opts }
  );
  return opts as OrderOpts;
}

function compileOrderExpr(expr: unknown): Sql {
  if (typeof expr === 'string') {
    return columnIdent(expr);
  }
  if (Array.isArray(expr) && isOpOrFnHead(expr[0])) {
    return compileExpr(expr, true);
  }
  return compileExpr(expr, true);
}
