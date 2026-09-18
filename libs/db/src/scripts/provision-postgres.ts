// @io-wall-ok
import { wallClock } from '@pkgs/clock';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';
import { pingDatabase } from '../shared/postgres-ping-source';

const log = createLogger({ name: 'db:provision', now: wallClock.now });

async function main(): Promise<void> {
  if (!isProductionSecretsEnv()) {
    log.info('[db:provision] dry-run (SECRETS_ENV is not prd)');
    return;
  }
  const result = await pingDatabase();
  if (!result.ok) {
    throw new Error(result.error ?? 'DATABASE_URL ping failed');
  }
  log.info('[db:provision] DATABASE_URL reachable');
}

await main();
