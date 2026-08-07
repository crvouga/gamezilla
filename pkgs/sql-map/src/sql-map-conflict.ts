import { assert } from '@pkgs/assert';
import sql, { empty, join, type Sql } from '@pkgs/sql';
import { compileExpr } from './sql-map-expr';
import { columnIdent } from './sql-map-ident';
import { SQL_MAP_LIST_SEP } from './sql-map-list-sep';
import type { OnConflict } from './sql-map-types';

/**
 * Compiles optional INSERT `ON CONFLICT` clause.
 */
export function compileOnConflict(onConflict: OnConflict | undefined): Sql {
  if (onConflict === undefined) {
    return empty;
  }
  assert.ok(
    Array.isArray(onConflict.target) && onConflict.target.length > 0,
    'sqlMap: onConflict.target must be a non-empty column list',
    { target: onConflict.target }
  );

  const target = join(
    onConflict.target.map((c) => columnIdent(c)),
    SQL_MAP_LIST_SEP
  );

  if (onConflict.doNothing === true) {
    assert.ok(
      onConflict.set === undefined,
      'sqlMap: onConflict cannot mix doNothing and set'
    );
    return sql<void>` ON CONFLICT (${target}) DO NOTHING`;
  }

  assert.defined(
    onConflict.set,
    'sqlMap: onConflict requires set or doNothing'
  );
  const entries = Object.entries(onConflict.set);
  assert.ok(entries.length > 0, 'sqlMap: onConflict.set must be non-empty');

  const sets = join(
    entries.map(([c, v]) => sql<void>`${columnIdent(c)} = ${compileExpr(v)}`),
    SQL_MAP_LIST_SEP
  );
  return sql<void>` ON CONFLICT (${target}) DO UPDATE SET ${sets}`;
}
