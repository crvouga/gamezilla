/**
 * The person acting at Apple, outside the app: stopping use of their Apple
 * Account with the app, or deleting it. Apple changes its own state and
 * notifies the API through the load balancer — so a partitioned API misses
 * the notification, exactly as it would in production.
 */

import {
  SIM_APPLE_CLIENT_ID,
  SIM_APPLE_IDP_URL,
} from '@libs/feature/public/sim-constants';
import {
  appleSubOf,
  type IdpAccountDraft,
  type IdpProviderKind,
} from '@pkgs/idp-sim/shared';

import { scenarioAction } from './actor-ui';
import { type AppleAccountKind, actorAppleEmail } from './identity';
import type { ProductSim } from './sim';

async function appleAdmin(
  s: ProductSim,
  path: string,
  init: { readonly method: string; readonly body?: unknown }
): Promise<void> {
  await s.sim.idps.apple.app.fetch(
    new Request(`${SIM_APPLE_IDP_URL}/__idp${path}`, {
      method: init.method,
      headers: { 'content-type': 'application/json' },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    })
  );
}

/** "Stop using Apple Account" with the app: the API signs the account out. */
export const appleRevokesApp = scenarioAction({
  name: 'appleRevokesApp',
  act: async (s, actorId: string, account: AppleAccountKind = 'gmail') => {
    await appleAdmin(s, '/grants/revoke', {
      method: 'POST',
      body: {
        sub: appleSubOf(actorAppleEmail(s, actorId, account)),
        clientId: SIM_APPLE_CLIENT_ID,
      },
    });
  },
});

/** The Apple Account is deleted for good; every app it used hears of it. */
export const appleDeletesAccount = scenarioAction({
  name: 'appleDeletesAccount',
  act: async (s, actorId: string, account: AppleAccountKind = 'gmail') => {
    const sub = appleSubOf(actorAppleEmail(s, actorId, account));
    await appleAdmin(s, `/accounts/${sub}`, { method: 'DELETE' });
  },
});

/**
 * Put an account in a provider's directory — the unusual shapes a scenario
 * needs (an address the provider never verified, a Workspace `hd`, …).
 */
export const seedProviderAccount = scenarioAction({
  name: 'seedProviderAccount',
  act: async (s, provider: IdpProviderKind, draft: IdpAccountDraft) => {
    await s.sim.idps[provider].addAccount(draft);
  },
});
