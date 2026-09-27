// @io-wall-ok
import { syncBillingOffer } from '@libs/billing/root/sync-billing-offer';
import { isProductionEnv } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import {
  MEMBERSHIP_PROVIDER_MODULES,
  membershipSecretReader,
} from '@pkgs/billing-providers';
import { wallClock } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { createBillingScriptSecretStore } from './billing-script-secret-store';

const log = createLogger({ name: 'billing sync', now: wallClock.now });
const cliHttp = createGlobalHttpClient();

await syncBillingOffer({
  // Apply only in a production environment (its env file's `protection`);
  // every other environment validates the offer and stops.
  production: isProductionEnv(
    envFile(process.env['SECRETS_ENV']?.trim() || 'dev')
  ),
  createSecretReader: async () =>
    membershipSecretReader(
      await createBillingScriptSecretStore({
        fetchFn: cliHttp.fetch.bind(cliHttp),
        now: wallClock.now,
      })
    ),
  modules: MEMBERSHIP_PROVIDER_MODULES,
  now: wallClock.now,
  fetch: cliHttp.fetch.bind(cliHttp),
  log,
}).catch((e: unknown) => {
  console.error(
    '[billing sync] failed',
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
