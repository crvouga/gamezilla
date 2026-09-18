/**
 * Local embedded Postgres listen port (avoid clashing with system :5432).
 * `.superset/port.sh` exports `POSTGRES_PORT` so parallel Superset workspaces
 * do not fight over the sidecar's fixed port.
 */
export const POSTGRES_PORT = Number(process.env['POSTGRES_PORT'] ?? 15_432);

export const POSTGRES_USER = 'postgres';
export const POSTGRES_PASSWORD = 'postgres';
export const POSTGRES_DATABASE = 'local';

export const POSTGRES_LOCAL_PORTS = [POSTGRES_PORT] as const;

/** Wire URL written into `@apps/server` `.dev.vars` for SECRETS_ENV=dev. */
export const LOCAL_DATABASE_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${String(POSTGRES_PORT)}/${POSTGRES_DATABASE}?sslmode=disable`;
