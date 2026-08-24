// @io-wall-ok
/**
 * Billing catalog sync — reconcile CATALOG_SPEC onto the billing vendor adapter.
 */
import { CATALOG_SPEC } from '@libs/billing/public/catalog';
import { wallClock } from '@pkgs/clock';
import { createStripeBillingFromSecretStore } from '@pkgs/billing-stripe';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createBillingScriptSecretStore } from './billing-script-secret-store';

const SCRIPT_TAG = 'billing sync';
const cliHttp = createGlobalHttpClient();

async function main(): Promise<void> {
  const store = await createBillingScriptSecretStore({
    fetchFn: cliHttp.fetch.bind(cliHttp),
    now: wallClock.now,
  });
  const billing = await createStripeBillingFromSecretStore(store);
  if (billing === null) {
    console.error(
      `[${SCRIPT_TAG}] billing secret key is missing or blank — run under \`bun run tools/scripts/secrets-run.ts\``
    );
    process.exit(1);
  }
  const catalog = await billing.syncCatalog(CATALOG_SPEC);
  console.log(
    `[${SCRIPT_TAG}] done`,
    JSON.stringify({
      catalog: {
        products: catalog.products.length,
        prices: catalog.prices.length,
      },
    })
  );
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
