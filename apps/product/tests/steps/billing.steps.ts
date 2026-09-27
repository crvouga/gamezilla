/** `specs/health/billing.feature`: billing keys per environment. */

import { expect } from 'bun:test';
import { isProductionEnv } from '@libs/infra/public/env-file';
import { PaddleSecretKeys } from '@pkgs/billing-paddle/secret-keys';
import { StripeSecretKeys } from '@pkgs/billing-stripe/secret-keys';
import { Then } from './define';

/** Live-mode key prefix per vendor secret; test/sandbox keys use another. */
const LIVE_PREFIX: ReadonlyArray<readonly [string, string]> = [
  [StripeSecretKeys.secretKey, 'sk_live_'],
  [StripeSecretKeys.publishableKey, 'pk_live_'],
  [PaddleSecretKeys.apiKey, 'pdl_live_'],
];

function configured(name: string): string | null {
  const value = process.env[name]?.trim() ?? '';
  return value.length > 0 ? value : null;
}

Then('at least one billing provider is configured', () => {
  const vendors = [StripeSecretKeys.secretKey, PaddleSecretKeys.apiKey];
  expect(vendors.filter((n) => configured(n) !== null)).not.toEqual([]);
});

Then("every configured billing key is in this environment's mode", (w) => {
  const live = isProductionEnv(w.env);
  const wrongMode = LIVE_PREFIX.filter(([name, prefix]) => {
    const value = configured(name);
    return value !== null && value.startsWith(prefix) !== live;
  }).map(([name]) => name);
  expect(
    wrongMode,
    `expected ${live ? 'live' : 'test/sandbox'} keys in ${w.env.env}`
  ).toEqual([]);
});
