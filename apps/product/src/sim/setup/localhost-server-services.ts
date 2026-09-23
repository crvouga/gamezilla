// @io-wall-ok — Node composition root for real dev vendor ports.

import { loadAuthBootConfig } from '@apps/server/config/auth-boot';
import {
  createStripeBillingFromSecretStore,
  StripeSecretKeys,
} from '@pkgs/billing-stripe';
import { wallClock } from '@pkgs/clock';
import { EMQX_DASHBOARD_PORT } from '@pkgs/emqx-server';
import { createEmqxHttpPubSub } from '@pkgs/pubsub-emqx/create-emqx-http-pubsub';
import { createRecordSecretStore } from '@pkgs/secret-store/record-secret-store';
import type { LocalhostServerServices } from '../fabric/create-sim';
import { createLocalhostObjectStore } from './wall-localhost-object-store';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`localhost profile requires ${name}`);
  }
  return value;
}

/** Real dev/sandbox vendor adapters; no test doubles enter this profile. */
export async function createLocalhostServerServices(
  apiOrigin: string
): Promise<LocalhostServerServices> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') values[key] = value;
  }
  values['API_URL'] = apiOrigin;
  const secrets = createRecordSecretStore(values);
  const auth = await loadAuthBootConfig({
    secretStore: secrets,
    apiUrlOverride: apiOrigin,
    enableDev: false,
  });
  if (!auth.googleEnabled) {
    throw new Error('localhost profile requires dev Google OAuth credentials');
  }
  const stripeKey = (
    await secrets.getRequired(StripeSecretKeys.secretKey)
  ).readSecretValue();
  if (!stripeKey.startsWith('sk_test_')) {
    throw new Error('localhost profile requires a Stripe test secret key');
  }
  const billing = await createStripeBillingFromSecretStore(
    secrets,
    wallClock.now
  );
  if (billing === null) {
    throw new Error('localhost profile requires STRIPE_SECRET_KEY');
  }
  return {
    billing,
    blob: createLocalhostObjectStore(required('SIM_OBJECT_STORE_ORIGIN')),
    secrets,
    auth,
    tts: null,
    llm: null,
    fetch: (input, init) => globalThis.fetch(input, init),
    createEvents: () =>
      createEmqxHttpPubSub({
        apiBaseUrl: `http://127.0.0.1:${String(EMQX_DASHBOARD_PORT)}`,
        apiKey: required('EMQX_API_KEY'),
        apiSecret: required('EMQX_API_SECRET'),
        fetchImpl: (input, init) => globalThis.fetch(input, init),
      }),
  };
}
