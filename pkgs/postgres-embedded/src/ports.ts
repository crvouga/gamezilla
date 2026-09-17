/** Local embedded Postgres listen port (avoid clashing with system :5432). */
export const POSTGRES_PORT = 15_432;

export const POSTGRES_USER = 'postgres';
export const POSTGRES_PASSWORD = 'postgres';
export const POSTGRES_DATABASE = 'local';

export const POSTGRES_LOCAL_PORTS = [POSTGRES_PORT] as const;

/** Wire URL for a cluster on `port` — loopback, no TLS. */
export function databaseUrlFor(port: number): string {
  return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${String(port)}/${POSTGRES_DATABASE}?sslmode=disable`;
}

/** Wire URL written into `@apps/server` `.dev.vars` for SECRETS_ENV=dev. */
export const LOCAL_DATABASE_URL = databaseUrlFor(POSTGRES_PORT);
