// @io-wall-ok
/**
 * CI gate: reconcile the plus membership offer onto the provider — no DB
 * mutation.
 *
 * - CI (`CI=true` / `GITHUB_ACTIONS=true`): require a resolvable billing secret
 *   and API origin; fail if either is missing.
 * - Local: silently skip when the secret store / keys are unavailable.
 *
 * This does write provider state (product, prices, portal configuration,
 * webhook endpoint) — that is what "the offer is the source of truth" means.
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

const SCRIPT_TAG = 'billing check';
const log = createLogger({ name: SCRIPT_TAG, now: wallClock.now });
const cliHttp = createGlobalHttpClient();

function isCi(): boolean {
  const ci = process.env['CI'];
  return (
    ci === 'true' || ci === '1' || process.env['GITHUB_ACTIONS'] === 'true'
  );
}

async function main(): Promise<void> {
  let store;
  try {
    store = await createBillingScriptSecretStore({
      fetchFn: cliHttp.fetch.bind(cliHttp),
      now: wallClock.now,
    });
  } catch {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI needs SECRETS_TOKEN (or secret store CLI login) so the reconcile can load secrets`
      );
      process.exit(1);
    }
    log.info(
      `[${SCRIPT_TAG}] skip reconcile — could not resolve secret store token`
    );
    return;
  }

  const billing = await createStripeMembershipBillingFromSecretStore(
    store,
    PLUS_MEMBERSHIP_OFFER,
    wallClock.now
  );
  if (billing === null) {
    if (isCi()) {
      console.error(`[${SCRIPT_TAG}] CI: billing secret key missing`);
      process.exit(1);
    }
    log.info(`[${SCRIPT_TAG}] skip reconcile — billing secret missing`);
    return;
  }

  const callbackUrl = await readOfferCallbackUrl(store);
  if (callbackUrl === null) {
    if (isCi()) {
      console.error(`[${SCRIPT_TAG}] CI: API_URL secret missing`);
      process.exit(1);
    }
    log.info(`[${SCRIPT_TAG}] skip reconcile — API origin missing`);
    return;
  }

  const result = await reconcileStripeOffer(
    billing.stripe,
    PLUS_MEMBERSHIP_OFFER,
    { callbackUrl }
  );
  log.info(`[${SCRIPT_TAG}] ok`, {
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
