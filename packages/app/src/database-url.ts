/**
 * Resolves a Postgres connection URL from DATABASE_URL or split RDS-style env vars.
 */
import { getRuntimeEnv } from './runtime-env';

export function resolveDatabaseUrl(): string | undefined {
  const env = getRuntimeEnv();
  const direct = env.DATABASE_URL;
  if (direct !== undefined && direct !== '') return direct;

  const host = env.DATABASE_HOST;
  const user = env.DATABASE_USERNAME;
  const password = env.DATABASE_PASSWORD;
  const port = env.DATABASE_PORT ?? '5432';
  const name = env.DATABASE_NAME ?? 'postgres';

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
