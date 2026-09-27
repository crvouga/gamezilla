// @io-wall-ok — live health: Infisical export and every vendor credential.
/**
 * `specs/health/secrets.feature`. Unlike the fingerprint-cached
 * `@libs/secrets#check`, this re-runs every registry `validate` live, so a
 * revoked key or suspended vendor account shows up between deploys.
 */

import { expect } from 'bun:test';
import { SECRETS } from '@libs/secrets/shared/secrets/registry';
import { validateSecretOrError } from '@libs/secrets/shared/secrets/secret';
import { exportSecretsMapLive } from '@libs/secrets/shared/secrets/secrets-io';
import { Given, Then } from './define';
import type { LiveWorld } from './live-world';

const STORED = 'stored-secrets';

function stored(w: LiveWorld): ReadonlyMap<string, string> {
  return w.memo.get(STORED) as ReadonlyMap<string, string>;
}

function valueOf(w: LiveWorld, name: string): string {
  return stored(w).get(name)?.trim() ?? '';
}

Given(
  "this environment's secrets are exported from the secret store",
  async (w) => {
    const exported = await exportSecretsMapLive(w.env.env);
    expect(exported.size).toBeGreaterThan(0);
    w.memo.set(STORED, exported);
  }
);

Then('every required secret is present', (w) => {
  const missing = SECRETS.filter(
    (secret) => !secret.optional && valueOf(w, secret.name).length === 0
  ).map((secret) => secret.name);
  expect(missing, `missing in ${w.env.env}`).toEqual([]);
});

Then('every present secret passes its live validation', async (w) => {
  const invalid: string[] = [];
  for (const secret of SECRETS) {
    const value = valueOf(w, secret.name);
    if (value.length === 0) continue;
    const error = await validateSecretOrError(secret, {
      env: w.env,
      secretValue: value,
      secrets: stored(w),
    });
    if (error !== null) invalid.push(`${secret.name}: ${String(error)}`);
  }
  expect(invalid).toEqual([]);
});
