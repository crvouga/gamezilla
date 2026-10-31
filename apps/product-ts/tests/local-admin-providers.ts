import {
  LOCAL_ADMIN_ACCOUNTS,
  localAdminIdentities,
} from '@apps/product-ts/scripts/local-admin-accounts';
import { createAppleClientKeys } from '@apps/product-ts/scripts/start-idps';
import { createRuntime } from '@crvouga/mockingbird-service-oauth';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import {
  appleEndpointsFor,
  googleEndpointsFor,
} from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import type { Clock } from '@pkgs/clock-shared-ts/types';

export const ADMIN_TEST_API = 'https://api.local.test';
export const ADMIN_TEST_GOOGLE = 'https://google.local.test';
export const ADMIN_TEST_APPLE = 'https://apple.local.test';

export async function localAdminProviders(clock: Clock) {
  const providerClock = {
    now: clock.now,
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: clock.now(), frozen: true, offsetMs: 0 }),
  };
  const accounts = [
    ...LOCAL_ADMIN_ACCOUNTS,
    { id: 'alice', email: 'alice@gmail.com', name: 'Alice Tester' },
  ];
  const keys = await createAppleClientKeys();
  const google = createRuntime({
    provider: 'google',
    issuer: ADMIN_TEST_GOOGLE,
    clock: providerClock,
    accounts,
    clients: [
      {
        id: 'local',
        name: PRODUCT_NAME,
        secret: 'local',
        redirectUris: [`${ADMIN_TEST_API}/auth/callback/google`],
      },
    ],
  });
  const apple = createRuntime({
    provider: 'apple',
    issuer: ADMIN_TEST_APPLE,
    clock: providerClock,
    accounts,
    clients: [
      {
        id: 'local',
        name: PRODUCT_NAME,
        redirectUris: [`${ADMIN_TEST_API}/auth/callback/apple`],
        apple: {
          teamId: 'LOCALTEAM',
          keyId: 'LOCALKEY',
          publicKey: keys.publicJwk,
        },
      },
    ],
  });
  return {
    google,
    apple,
    identities: [
      ...(await localAdminIdentities('google', 'local', google)),
      ...(await localAdminIdentities('apple', 'local', apple)),
    ],
    config: {
      google: {
        clientId: 'local',
        clientSecret: 'local',
        endpoints: googleEndpointsFor(ADMIN_TEST_GOOGLE),
      },
      apple: {
        clientId: 'local',
        teamId: 'LOCALTEAM',
        keyId: 'LOCALKEY',
        privateJwk: keys.privateJwk,
        endpoints: appleEndpointsFor(ADMIN_TEST_APPLE),
        issuer: ADMIN_TEST_APPLE,
      },
    },
  };
}
