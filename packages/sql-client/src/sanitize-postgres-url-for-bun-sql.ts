/**
 * Bun's built-in {@link SQL} Postgres (TCP) driver treats some libpq URI query
 * parameters in a way that makes the server respond with
 * `unrecognized configuration parameter "…"` for options that are client-only
 * in libpq (TLS material paths). Managed providers often append these to
 * `DATABASE_URL` while Neon HTTP accepts the same string unchanged.
 *
 * Strip those keys before opening a Bun TCP connection; TLS still uses the
 * platform trust store and `sslmode` when present.
 *
 * @see https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING-KEYWORD-VALUE
 */
const LIBPQ_TLS_FILE_PARAMS = [
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslcrl',
  'sslidentity',
  'sslpassword',
] as const;

export function sanitizePostgresUrlForBunSql(connection: string | URL): string {
  let url: URL | null;
  let originalSerialized: string;
  if (typeof connection === 'string') {
    originalSerialized = connection;
    url = tryParsePostgresUrl(connection);
  } else {
    originalSerialized = connection.toString();
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
  for (const key of LIBPQ_TLS_FILE_PARAMS) {
    if (url.searchParams.has(key)) {
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
