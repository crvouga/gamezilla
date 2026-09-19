// @io-wall-ok
/**
 * Billing sync — reconcile the plus membership offer onto the provider.
 */
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import {
  createStripeMembershipBillingFromSecretStore,
  reconcileStripeOffer,
} from '@pkgs/billing-stripe';
import { wallClock } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { readOfferCallbackUrl } from './billing-reconcile';
import { createBillingScriptSecretStore } from './billing-script-secret-store';

const SCRIPT_TAG = 'billing sync';
const log = createLogger({ name: SCRIPT_TAG, now: wallClock.now });
const cliHttp = createGlobalHttpClient();

async function main(): Promise<void> {
  const store = await createBillingScriptSecretStore({
    fetchFn: cliHttp.fetch.bind(cliHttp),
    now: wallClock.now,
  });
  const billing = await createStripeMembershipBillingFromSecretStore(
    store,
    PLUS_MEMBERSHIP_OFFER,
    wallClock.now
  );
  if (billing === null) {
    console.error(
      `[${SCRIPT_TAG}] billing secret key is missing or blank — run under \`bun run libs/secrets/src/scripts/secrets-run.ts\``
    );
    process.exit(1);
  }
  const callbackUrl = await readOfferCallbackUrl(store);
  if (callbackUrl === null) {
    console.error(
      `[${SCRIPT_TAG}] API_URL secret is missing or blank — the provider needs an absolute callback URL`
    );
    process.exit(1);
  }
  const result = await reconcileStripeOffer(
    billing.stripe,
    PLUS_MEMBERSHIP_OFFER,
    { callbackUrl }
  );
  log.info(`[${SCRIPT_TAG}] done`, {
    products: result.products.length,
    prices: result.prices.length,
    portalConfigurationId: result.portalConfigurationId,
    webhookEndpointId: result.webhookEndpointId,
  });
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
