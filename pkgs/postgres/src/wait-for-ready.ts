/**
 * Non-persistent Turbo gate: poll until the embedded cluster accepts connections.
 * Used by `preview:wait` so `@apps/api` / `@pkgs/dev-idp` preview tasks can
 * depend on Postgres readiness without depending on the persistent `preview`
 * task (Turbo forbids persistent → persistent edges).
 */
import { createLogger } from '@pkgs/logger';
import { pingPostgres } from '@pkgs/sql-client/postgres-connect';

import { buildConnectionUrl, loadPostgresConfig } from './postgres-config';

const WAIT_MS = 120_000;
const RETRY_MS = 250;

async function main(): Promise<void> {
  const log = createLogger({ name: 'postgres:wait' });
  const databaseUrl = buildConnectionUrl(loadPostgresConfig());
  const started = Date.now();
  const deadline = started + WAIT_MS;
  let attempt = 0;
  let lastError: unknown;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      await pingPostgres(databaseUrl);
      if (attempt > 1) {
        log.info('postgres ready', { attempt, elapsedMs: Date.now() - started });
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 1 || attempt % 10 === 0) {
        log.info('waiting for postgres', {
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await Bun.sleep(RETRY_MS);
    }
  }

  throw new Error(
    `postgres not reachable within ${WAIT_MS}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

await main();
