import { assert } from '@pkgs/assert';

import { compileExpr, isOpOrFnHead } from './honey-expr';
import { columnIdent } from './honey-ident';
import { isHoneyCollation } from './honey-registry';
import type { OrderItem, OrderOpts } from './honey-types';
import { HONEY_LIST_SEP } from './honey-list-sep';
import sql, { empty, join, raw, type Sql } from './sql';

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
  assert.ok(Array.isArray(o) && o.length >= 2, 'honey: bad order item', { o });
  const expr = o[0];
  const dir = o[1];
  assert.enum(dir, ['asc', 'desc'], 'honey: bad sort dir');
  const opts = readOrderOpts(o[2]);
  // SQLite requires COLLATE before ASC/DESC; Postgres accepts both orders.
  let out = compileOrderExpr(expr);
  if (opts?.collate !== undefined) {
    assert.ok(isHoneyCollation(opts.collate), 'honey: unknown collation', {
      collate: opts.collate,
    });
    out = sql`${out} COLLATE ${raw(opts.collate.toUpperCase())}`;
  }
  out = sql`${out} ${raw(dir.toUpperCase())}`;
  if (opts?.nulls !== undefined) {
    assert.enum(opts.nulls, ['first', 'last'], 'honey: bad nulls');
    out = sql`${out} NULLS ${raw(opts.nulls.toUpperCase())}`;
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
    'honey: order opts must be an object',
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
