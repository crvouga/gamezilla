import { assert } from '@gamezilla/shared/assert';

/**
 * Converts SQLite JSON path strings used by patch-db into a single top-level JSON key
 * for PostgreSQL {@code ->>} / {@code jsonb_set}.
 *
 * @example sqliteJsonPathToKey('$.foo') → 'foo'
 * @example sqliteJsonPathToKey('$."a/b"') → 'a/b'
 */
export function sqliteJsonPathToKey(path: string): string {
  assert.ok(path.startsWith('$.'), 'Invalid PostgreSQL JSON path', { path });
  const rest = path.slice(2);
  if (rest.startsWith('"')) {
    let out = '';
    for (let i = 1; i < rest.length; i++) {
      const c = rest[i];
      assert.defined(c, 'path parse');
      if (c === '"') break;
      if (c === '\\') {
        i++;
        const next = rest[i];
        assert.defined(next, 'path parse escape');
        out += next;
        continue;
      }
      out += c;
    }
    return out;
  }
  return rest;
}
