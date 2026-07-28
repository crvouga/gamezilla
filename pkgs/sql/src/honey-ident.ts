import { assert } from '@pkgs/assert';

import { ident, join, raw, type Sql } from './sql';

const STAR = '*';
const DOT = '.';

/**
 * Compiles a dotted identifier path (or `*`) to a {@link Sql} fragment.
 * Each path segment is validated via {@link ident}; `*` is spliced as raw.
 */
export function columnIdent(name: string): Sql {
  assert.string(name, 'honey: identifier must be a string', { name });
  assert.ok(name.length > 0, 'honey: identifier must be non-empty', { name });

  if (name === STAR) {
    return raw(STAR);
  }

  const parts = name.split(DOT);
  assert.ok(parts.length >= 1, 'honey: identifier path empty', { name });

  if (parts.length === 1) {
    const part = parts[0];
    assert.defined(part, 'honey: identifier path missing segment', { name });
    return part === STAR ? raw(STAR) : ident(part);
  }

  return join(
    parts.map((part, index) => {
      assert.ok(part.length > 0, 'honey: empty identifier segment', {
        name,
        index,
      });
      return part === STAR ? raw(STAR) : ident(part);
    }),
    DOT
  );
}
