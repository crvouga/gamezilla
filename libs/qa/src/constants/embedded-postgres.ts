import { pingPostgres } from '@pkgs/sql-client/postgres-connect';

/** Mirrors {@link @pkgs/postgres} defaults and {@link @pkgs/dev-idp} database URL. */
export const LOCAL_EMBEDDED_POSTGRES_URL =
  'postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable';

/** Env overrides for preview/QA so migrations hit the embedded cluster, not Vault hosted Postgres. */
export function previewStackEnv(): Record<string, string> {
  return {
    DATABASE_URL: LOCAL_EMBEDDED_POSTGRES_URL,
    POSTGRES_SCHEMA: 'gamezilla',
  };
}

export async function waitForEmbeddedPostgres(
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: string | undefined;
  while (Date.now() < deadline) {
    try {
      await pingPostgres(LOCAL_EMBEDDED_POSTGRES_URL);
      return;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await Bun.sleep(250);
    }
  }
  throw new Error(
    `embedded postgres not reachable (${timeoutMs}ms). Last: ${lastErr ?? 'unknown'}`
  );
}
