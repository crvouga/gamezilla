// @io-wall-ok
/**
 * Billing sync — reconcile the plus membership offer onto every configured
 * provider, each with its own callback URL. Providers are the shared list,
 * never named here: one without credentials is skipped; none configured is
 * an error.
 */
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import {
  MEMBERSHIP_PROVIDER_MODULES,
  membershipSecretReader,
} from '@pkgs/billing-providers';
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
  const env = {
    readSecret: membershipSecretReader(store),
    offer: PLUS_MEMBERSHIP_OFFER,
    now: wallClock.now,
    fetch: cliHttp.fetch.bind(cliHttp),
  };
  const synced: string[] = [];
  for (const module of MEMBERSHIP_PROVIDER_MODULES) {
    if (module.reconcile === undefined) continue;
    const callbackUrl = await readOfferCallbackUrl(store, module.provider);
    if (callbackUrl === null) {
      throw new Error(
        'API_URL secret is missing or blank — providers need an absolute callback URL'
      );
    }
    const result = await module.reconcile({ ...env, callbackUrl, log });
    if (result === null) continue;
    synced.push(module.provider);
    log.info(`[${SCRIPT_TAG}] ${module.provider} done`, result);
  }
  if (synced.length === 0) {
    const names = MEMBERSHIP_PROVIDER_MODULES.flatMap((m) =>
      m.secrets.map((s) => s.name)
    );
    console.error(
      `[${SCRIPT_TAG}] no billing provider credentials (${names.join(', ')}) — run under \`bun run libs/secrets/src/scripts/secrets-run.ts\``
    );
    process.exit(1);
  }
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});
