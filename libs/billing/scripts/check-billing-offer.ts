// @io-wall-ok
/**
 * Gate: reconcile the plus membership offer onto the provider — no DB
 * mutation.
 *
 * **One verdict, everywhere.** This used to skip silently off CI and hard-fail
 * on it, so the same code on the same commit passed locally and failed in CI —
 * a green local gate that meant nothing. Now missing secrets fail the same way
 * in both places: a run that cannot reconcile says so, and the CI failure is
 * reproducible on a laptop. Get the secrets with `bun run secrets:pull`
 * (`infisical login` first) rather than reaching for an environment branch.
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

/** Every "cannot reconcile" path ends here, on every machine. */
function unavailable(reason: string): never {
  console.error(
    `[${SCRIPT_TAG}] ${reason}. This gate reconciles the offer onto the ` +
      'provider, so it needs real credentials: run `infisical login` then ' +
      '`bun run secrets:pull`. It fails the same way in CI and locally on ' +
      'purpose — a skip here would be a green check that proved nothing.'
  );
  process.exit(1);
}

async function main(): Promise<void> {
  let store;
  try {
    store = await createBillingScriptSecretStore({
      fetchFn: cliHttp.fetch.bind(cliHttp),
      now: wallClock.now,
    });
  } catch {
    unavailable('could not resolve a secret store token');
  }

  const billing = await createStripeMembershipBillingFromSecretStore(
    store,
    PLUS_MEMBERSHIP_OFFER,
    wallClock.now
  );
  if (billing === null) {
    unavailable('the billing secret key is missing');
  }

  const callbackUrl = await readOfferCallbackUrl(store);

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
