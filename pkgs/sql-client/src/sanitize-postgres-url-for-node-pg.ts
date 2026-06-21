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

function isPostgresProtocol(protocol: string): boolean {
  return protocol === 'postgres:' || protocol === 'postgresql:';
}

function originalSerialized(connection: string | URL): string {
  return typeof connection === 'string' ? connection : connection.toString();
}

function resolvePostgresUrl(connection: string | URL): URL | null {
  if (typeof connection === 'string') {
    return tryParsePostgresUrl(connection);
  }
  if (!isPostgresProtocol(connection.protocol)) return null;
  return new URL(connection.href);
}

function normalizeSslModeForNodePg(url: URL): boolean {
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode !== 'require' && sslmode !== 'prefer' && sslmode !== 'verify-ca') {
    return false;
  }
  // pg@8.20 / pg-connection-string@2.12 warn that these modes are currently
  // aliased to verify-full; pin explicitly so CI logs stay clean.
  url.searchParams.set('sslmode', 'verify-full');
  return true;
}

function stripLibpqTlsSentinels(url: URL): boolean {
  let changed = false;
  for (const key of LIBPQ_TLS_PATH_KEYS) {
    const value = url.searchParams.get(key);
    if (value !== null && LIBPQ_SENTINEL_VALUES.has(value)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed;
}

export function sanitizePostgresUrlForNodePg(connection: string | URL): string {
  const serialized = originalSerialized(connection);
  const url = resolvePostgresUrl(connection);
  if (url === null) return serialized;

  const changed =
    normalizeSslModeForNodePg(url) || stripLibpqTlsSentinels(url);
  return changed ? url.toString() : serialized;
}

function tryParsePostgresUrl(connection: string): URL | null {
  try {
    const u = new URL(connection);
    if (!isPostgresProtocol(u.protocol)) return null;
    return u;
  } catch {
    return null;
  }
}
