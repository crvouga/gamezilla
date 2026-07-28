import { assert } from '@pkgs/assert';

import { compileExpr, isQuery } from './honey-expr';
import { columnIdent } from './honey-ident';
import { HONEY_LIST_SEP } from './honey-list-sep';
import type { Query, WithItem } from './honey-types';
import sql, { empty, join, raw, type Sql } from './sql';

/**
 * Compiles optional `WITH` CTE preamble.
 */
export function compileWith(items: readonly WithItem[] | undefined): Sql {
  if (!items || items.length === 0) {
    return empty;
  }
  return sql`WITH ${join(
    items.map((item) => compileWithItem(item)),
    HONEY_LIST_SEP
  )} `;
}

function compileWithItem(item: WithItem): Sql {
  assert.equals(item.length, 2, 'honey: with item needs [alias, query]', {
    length: item.length,
  });
  const [alias, q] = item;
  assert.string(alias, 'honey: with alias must be a string', { alias });
  assert.ok(isQuery(q), 'honey: with body must be a query map', { q });
  return sql`${columnIdent(alias)} AS ${compileExpr(q)}`;
}

/**
 * Compiles `UNION` / `UNION ALL` compound queries.
 */
export function compileUnion(
  kind: 'UNION' | 'UNION ALL',
  parts: readonly Query[] | undefined
): Sql {
  assert.defined(parts, `honey: ${kind.toLowerCase()} requires query list`);
  assert.ok(parts.length >= 2, `honey: ${kind.toLowerCase()} needs ≥2 queries`, {
    length: parts.length,
  });
  return join(
    parts.map((q) => {
      assert.ok(isQuery(q), 'honey: union part must be a query map', { q });
      return compileExpr(q);
    }),
    ` ${kind} `
  );
}

/**
 * Compiles `FOR UPDATE [SKIP LOCKED]` trailing clause.
 */
export function compileForUpdate(
  forUpdate: boolean | undefined,
  skipLocked: boolean | undefined
): Sql {
  if (!forUpdate) {
    assert.ok(
      !skipLocked,
      'honey: skipLocked requires forUpdate'
    );
    return empty;
  }
  if (skipLocked) {
    return raw(' FOR UPDATE SKIP LOCKED');
  }
  return raw(' FOR UPDATE');
}
