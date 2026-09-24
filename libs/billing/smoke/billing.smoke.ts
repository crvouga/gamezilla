// @io-wall-ok — live smoke probe (billing vendor configuration per env).
import { describe, expect, test } from 'bun:test';
import { PaddleSecretKeys } from '@pkgs/billing-paddle/secret-keys';
import { StripeSecretKeys } from '@pkgs/billing-stripe/secret-keys';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';

const prd = isProductionSecretsEnv();

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

describe(`billing (${prd ? 'prd' : 'dev'})`, () => {
  test.skipIf(!prd)('production bills through at least one provider', () => {
    const vendors = [StripeSecretKeys.secretKey, PaddleSecretKeys.apiKey];
    expect(
      vendors.filter((n) => configured(n) !== null).length
    ).toBeGreaterThan(0);
  });

  for (const [name, livePrefix] of LIVE_PREFIX) {
    test(`${name} is ${prd ? 'live' : 'test/sandbox'} mode`, () => {
      const value = configured(name);
      if (value === null) return;
      expect(value.startsWith(livePrefix)).toBe(prd);
    });
  }
});
