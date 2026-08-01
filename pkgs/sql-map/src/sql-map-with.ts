import { assert } from '@pkgs/assert';

import { compileExpr, isQuery } from './sql-map-expr';
import { columnIdent } from './sql-map-ident';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';
import type { Query, WithItem } from './sql-map-types';
import sql, { empty, join, raw, type Sql } from '@pkgs/sql';

/**
 * Compiles optional `WITH` CTE preamble.
 */
export function compileWith(items: readonly WithItem[] | undefined): Sql {
  if (!items || items.length === 0) {
    return empty;
  }
  return sql`WITH ${join(
    items.map((item) => compileWithItem(item)),
    SQL_MAP_LIST_SEP
  )} `;
}

function compileWithItem(item: WithItem): Sql {
  assert.equals(item.length, 2, 'sqlMap: with item needs [alias, query]', {
    length: item.length,
  });
  const [alias, q] = item;
  assert.string(alias, 'sqlMap: with alias must be a string', { alias });
  assert.ok(isQuery(q), 'sqlMap: with body must be a query map', { q });
  return sql`${columnIdent(alias)} AS ${compileExpr(q)}`;
}

/**
 * Compiles `UNION` / `UNION ALL` compound queries.
 */
export function compileUnion(
  kind: 'UNION' | 'UNION ALL',
  parts: readonly Query[] | undefined
): Sql {
  assert.defined(parts, `sqlMap: ${kind.toLowerCase()} requires query list`);
  assert.ok(
    parts.length >= 2,
    `sqlMap: ${kind.toLowerCase()} needs ≥2 queries`,
    {
      length: parts.length,
    }
  );
  return join(
    parts.map((q) => {
      assert.ok(isQuery(q), 'sqlMap: union part must be a query map', { q });
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
    assert.ok(!skipLocked, 'sqlMap: skipLocked requires forUpdate');
    return empty;
  }
  if (skipLocked) {
    return raw(' FOR UPDATE SKIP LOCKED');
  }
  return raw(' FOR UPDATE');
}
