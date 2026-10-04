import type { MembershipProviderEnv, MembershipProviderFetch, MembershipProviderModule } from '@pkgs/billing-shared/provider-module';
import type { Logger } from '@pkgs/logger-shared/logger';
import { PLUS_MEMBERSHIP_OFFER } from './plus-membership-offer';
import { readOfferCallbackUrl } from './read-offer-callback-url';
import { validatePlusMembershipOffer } from './validate-offer';

export type SyncBillingOfferOptions = {
  readonly production: boolean;
  readonly createSecretReader: () => Promise<
    MembershipProviderEnv['readSecret']
  >;
  readonly modules: readonly MembershipProviderModule[];
  readonly now: () => number;
  readonly fetch: MembershipProviderFetch;
  readonly log: Logger;
};

export async function syncBillingOffer(
  options: SyncBillingOfferOptions
): Promise<void> {
  const { log } = options;
  if (!options.production) {
    const problems = validatePlusMembershipOffer(PLUS_MEMBERSHIP_OFFER);
    if (problems.length > 0) throw new Error(problems.join('\n'));
    log.info(
      '[billing sync] dry-run (not a production environment) — offer validated'
    );
    return;
  }
  const readSecret = await options.createSecretReader();
  const env = {
    readSecret,
    offer: PLUS_MEMBERSHIP_OFFER,
    now: options.now,
    fetch: options.fetch,
  };
  const synced: string[] = [];
  for (const module of options.modules) {
    if (module.reconcile === undefined) continue;
    const callbackUrl = await readOfferCallbackUrl(readSecret, module.provider);
    if (callbackUrl === null) {
      throw new Error(
        'API_URL secret is missing or blank — providers need an absolute callback URL'
      );
    }
    const result = await module.reconcile({ ...env, callbackUrl, log });
    if (result === null) continue;
    synced.push(module.provider);
    log.info(`[billing sync] ${module.provider} done`, result);
  }
  if (synced.length === 0) {
    const names = options.modules.flatMap((m) => m.secrets.map((s) => s.name));
    throw new Error(
      `[billing sync] no billing provider credentials (${names.join(', ')}) — run under \`bun run libs/secrets-server/src/secrets-run.ts\``
    );
  }
}
