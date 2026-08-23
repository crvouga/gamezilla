import { isProductionSecretsEnv } from '../../../../tools/src/deploy-mode';
import { pingDatabase } from '../shared/postgres-ping-source';

async function main(): Promise<void> {
  if (!isProductionSecretsEnv()) {
    console.log('[db:provision] dry-run (SECRETS_ENV is not prd)');
    return;
  }
  const result = await pingDatabase();
  if (!result.ok) {
    throw new Error(result.error ?? 'DATABASE_URL ping failed');
  }
  console.log('[db:provision] DATABASE_URL reachable');
}

await main();
