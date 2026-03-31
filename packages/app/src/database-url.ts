/**
 * Resolves a Postgres connection URL from DATABASE_URL or split RDS-style env vars.
 */
export function resolveDatabaseUrl(): string | undefined {
  const direct = process.env['DATABASE_URL'];
  if (direct !== undefined && direct !== '') return direct;

  const host = process.env['DATABASE_HOST'];
  const user = process.env['DATABASE_USERNAME'];
  const password = process.env['DATABASE_PASSWORD'];
  const port = process.env['DATABASE_PORT'] ?? '5432';
  const name = process.env['DATABASE_NAME'] ?? 'postgres';

  if (
    host !== undefined &&
    host !== '' &&
    user !== undefined &&
    user !== '' &&
    password !== undefined &&
    password !== ''
  ) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
  }

  return undefined;
}
