// @io-wall-ok
/**
 * CI gate: run catalog reconcile only — no DB mutation.
 *
 * - CI (`CI=true` / `GITHUB_ACTIONS=true`): require resolvable billing secret; fail if missing.
 * - Local: silently skip when secret store / key is unavailable.
 */
import { CATALOG_SPEC } from '@libs/billing/public/catalog';
import { wallClock } from '@pkgs/clock';
import { createStripeBillingFromSecretStore } from '@pkgs/billing-stripe';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createBillingScriptSecretStore } from './billing-script-secret-store';

const SCRIPT_TAG = 'billing check';
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
        `[${SCRIPT_TAG}] CI needs SECRETS_TOKEN (or secret store CLI login) so catalog sync can load secrets`
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — could not resolve secret store token`
    );
    return;
  }

  const billing = await createStripeBillingFromSecretStore(store);
  if (billing === null) {
    if (isCi()) {
      console.error(`[${SCRIPT_TAG}] CI: billing secret key missing`);
      process.exit(1);
    }
    console.log(`[${SCRIPT_TAG}] skip catalog sync — billing secret missing`);
    return;
  }

  const catalog = await billing.syncCatalog(CATALOG_SPEC);
  console.log(
    `[${SCRIPT_TAG}] ok`,
    JSON.stringify({
      products: catalog.products.length,
      prices: catalog.prices.length,
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
