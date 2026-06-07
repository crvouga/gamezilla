/**
 * `pg-connection-string` (as of `2.12.0`, used by `pg@8.20`) does not
 * understand libpq sentinel values for TLS material — notably
 * `sslrootcert=system`, which in libpq means "use the operating system's
 * trust store". `pg` instead blindly calls `fs.readFileSync(value)` and
 * crashes with `ENOENT: no such file or directory, open 'system'` while
 * parsing the connection string.
 *
 * Managed providers (PlanetScale Postgres in our case) emit
 * `?sslmode=verify-full&sslrootcert=system` on the `DATABASE_URL` they hand
 * out, so any script that opens `new Pool({ connectionString })` blows
 * up before sending a single byte.
 *
 * Strip those sentinel values before constructing `pg.Pool` / `pg.Client`.
 * With `sslrootcert` removed, `pg` falls back to Node's bundled CA list,
 * which already covers the public CAs that sign Planetscale / Neon /
 * Supabase server certificates — so `sslmode=verify-full` still works.
 *
 * Real file paths (e.g. `sslrootcert=/etc/ssl/ca.pem`) are left intact —
 * those work in `pg` and we should not silently drop them.
 *
 * @see https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING-KEYWORD-VALUE
 * @see https://github.com/brianc/node-postgres/issues/2862
 */

const LIBPQ_TLS_PATH_KEYS = [
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslcrl',
  'sslidentity',
] as const;

/**
 * Values that libpq interprets as "look up TLS material from the OS"
 * rather than as a filesystem path. `pg-connection-string` does not
 * implement any of these, so a literal `readFileSync` crash is the only
 * possible outcome.
 */
const LIBPQ_SENTINEL_VALUES = new Set<string>(['system']);

export function sanitizePostgresUrlForNodePg(connection: string | URL): string {
  const originalSerialized =
    typeof connection === 'string' ? connection : connection.toString();
  let url: URL | null;
  if (typeof connection === 'string') {
    url = tryParsePostgresUrl(connection);
  } else {
    if (
      connection.protocol !== 'postgres:' &&
      connection.protocol !== 'postgresql:'
    ) {
      return originalSerialized;
    }
    url = new URL(connection.href);
  }
  if (url === null) return originalSerialized;

  let changed = false;
  for (const key of LIBPQ_TLS_PATH_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null && LIBPQ_SENTINEL_VALUES.has(value)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? url.toString() : originalSerialized;
}

function tryParsePostgresUrl(connection: string): URL | null {
  try {
    const u = new URL(connection);
    if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return null;
    return u;
  } catch {
    return null;
  }
}
