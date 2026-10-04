/**
 * The person acting at Apple, outside the app: stopping use of their Apple
 * Account with the app, or deleting it. Apple changes its own state and
 * notifies the API through the load balancer — so a partitioned API misses
 * the notification, exactly as it would in production.
 */

import { HARNESS_APPLE_CLIENT_ID } from '@libs/feature-shared/harness-constants';

import type { HarnessIdpAccount, HarnessIdpProvider } from './idp';
import { harnessIdpAccountId } from './idp';
import { scenarioAction } from './actor-ui';
import type { ProductHarness } from './harness';
import type { AppleAccountKind } from './identity';
import { actorAppleEmail } from './identity';

async function appleAdmin(
  s: ProductHarness,
  path: string,
  body: unknown
): Promise<void> {
  const apple = s.harness.idps.apple;
  const response = await apple.fetch(`${apple.origin}/__admin${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `apple ${path} → ${String(response.status)}: ${await response.text()}`
    );
  }
}

/** "Stop using Apple Account" with the app: the API signs the account out. */
export const appleRevokesApp = scenarioAction({
  name: 'appleRevokesApp',
  act: async (s, actorId: string, account: AppleAccountKind = 'gmail') => {
    await appleAdmin(s, '/consents/revoke', {
      clientId: HARNESS_APPLE_CLIENT_ID,
      accountId: harnessIdpAccountId(actorAppleEmail(s, actorId, account)),
    });
  },
});

/** The Apple Account is deleted for good; every app it used hears of it. */
export const appleDeletesAccount = scenarioAction({
  name: 'appleDeletesAccount',
  act: async (s, actorId: string, account: AppleAccountKind = 'gmail') => {
    await appleAdmin(s, '/accounts/delete', {
      accountId: harnessIdpAccountId(actorAppleEmail(s, actorId, account)),
    });
  },
});

/**
 * Put an account in a provider's directory — the unusual shapes a scenario
 * needs (an address the provider never verified, …).
 */
export const seedProviderAccount = scenarioAction({
  name: 'seedProviderAccount',
  act: (s, provider: HarnessIdpProvider, account: HarnessIdpAccount) => {
    s.harness.idps[provider].addAccount(account);
  },
});
