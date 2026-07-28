import { assert } from '@pkgs/assert';

import { compileExpr } from './honey-expr';
import { columnIdent } from './honey-ident';
import { HONEY_LIST_SEP } from './honey-list-sep';
import type { OnConflict } from './honey-types';
import sql, { empty, join, type Sql } from './sql';

/**
 * Compiles optional INSERT `ON CONFLICT` clause.
 */
export function compileOnConflict(
  onConflict: OnConflict | undefined
): Sql {
  if (onConflict === undefined) {
    return empty;
  }
  assert.ok(
    Array.isArray(onConflict.target) && onConflict.target.length > 0,
    'honey: onConflict.target must be a non-empty column list',
    { target: onConflict.target }
  );

  const target = join(
    onConflict.target.map((c) => columnIdent(c)),
    HONEY_LIST_SEP
  );

  if (onConflict.doNothing === true) {
    assert.ok(
      onConflict.set === undefined,
      'honey: onConflict cannot mix doNothing and set'
    );
    return sql` ON CONFLICT (${target}) DO NOTHING`;
  }

  assert.defined(onConflict.set, 'honey: onConflict requires set or doNothing');
  const entries = Object.entries(onConflict.set);
  assert.ok(entries.length > 0, 'honey: onConflict.set must be non-empty');

  const sets = join(
    entries.map(([c, v]) => sql`${columnIdent(c)} = ${compileExpr(v)}`),
    HONEY_LIST_SEP
  );
  return sql` ON CONFLICT (${target}) DO UPDATE SET ${sets}`;
}
