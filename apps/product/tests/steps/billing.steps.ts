// @io-wall-ok — live health: billing vendor keys, validated against the vendor.
/** `specs/billing/payments.feature`: billing keys per environment. */

import { expect } from 'bun:test';
import { isProductionEnv } from '@libs/infra/public/env-file';
import { SECRETS } from '@libs/secrets/shared/secrets/registry';
import { validateSecretOrError } from '@libs/secrets/shared/secrets/secret';
import { PaddleSecretKeys } from '@pkgs/billing-paddle/secret-keys';
import { StripeSecretKeys } from '@pkgs/billing-stripe/secret-keys';
import { Then } from './define';
import { liveSecretOrEmpty, liveSecrets } from './live-secrets';

/** Live-mode key prefix per vendor secret; test/sandbox keys use another. */
const LIVE_PREFIX: ReadonlyArray<readonly [string, string]> = [
  [StripeSecretKeys.secretKey, 'sk_live_'],
  [StripeSecretKeys.publishableKey, 'pk_live_'],
  [PaddleSecretKeys.apiKey, 'pdl_live_'],
];

/** The vendor keys that take a payment; one accepted key is enough. */
const PAYMENT_KEYS = [StripeSecretKeys.secretKey, PaddleSecretKeys.apiKey];

Then('people can pay for Plus', async (w) => {
  const secrets = await liveSecrets(w);
  const verdicts: string[] = [];
  for (const secret of SECRETS.filter((s) => PAYMENT_KEYS.includes(s.name))) {
    const value = secrets.get(secret.name)?.trim() ?? '';
    if (value.length === 0) {
      verdicts.push(`${secret.name}: not set`);
      continue;
    }
    const error = await validateSecretOrError(secret, {
      env: w.env,
      secretValue: value,
      secrets,
    });
    verdicts.push(`${secret.name}: ${error === null ? 'ok' : String(error)}`);
  }
  expect(
    verdicts.some((verdict) => verdict.endsWith(': ok')),
    `no payment vendor accepts this environment: ${verdicts.join('; ')}`
  ).toBe(true);
});

Then(
  'payments in this environment are real exactly when it is a production environment',
  async (w) => {
    const live = isProductionEnv(w.env);
    const wrongMode: string[] = [];
    for (const [name, prefix] of LIVE_PREFIX) {
      const value = await liveSecretOrEmpty(w, name);
      if (value.length > 0 && value.startsWith(prefix) !== live) {
        wrongMode.push(name);
      }
    }
    expect(
      wrongMode,
      `expected ${live ? 'live' : 'test/sandbox'} keys in ${w.env.env}`
    ).toEqual([]);
  }
);
