import { assert } from '@pkgs/assert-shared/singleton';

import { ident, join, raw } from '@pkgs/sql-shared/sql';
import type { Sql } from '@pkgs/sql-shared/sql';

const STAR = '*';
const DOT = '.';

/**
 * Compiles a dotted identifier path (or `*`) to a {@link Sql} fragment.
 * Each path segment is validated via {@link ident}; `*` is spliced as raw.
 */
export function columnIdent(name: string): Sql {
  assert.string(name, 'sqlMap: identifier must be a string', { name });
  assert.ok(name.length > 0, 'sqlMap: identifier must be non-empty', { name });

  if (name === STAR) {
    return raw(STAR);
  }

  const parts = name.split(DOT);
  assert.ok(parts.length >= 1, 'sqlMap: identifier path empty', { name });

  if (parts.length === 1) {
    const part = parts[0];
    assert.defined(part, 'sqlMap: identifier path missing segment', { name });
    return part === STAR ? raw(STAR) : ident(part);
  }

  return join(
    parts.map((part, index) => {
      assert.ok(part.length > 0, 'sqlMap: empty identifier segment', {
        name,
        index,
      });
      return part === STAR ? raw(STAR) : ident(part);
    }),
    DOT
  );
}
