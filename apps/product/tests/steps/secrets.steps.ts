// @io-wall-ok — live health: Infisical export and every vendor credential.
/**
 * `specs/health/connected-services.feature`. Unlike the fingerprint-cached
 * `@libs/secrets#check`, this re-runs every registry `validate` live, so a
 * revoked key or suspended vendor account shows up between deploys.
 */

import { expect } from 'bun:test';
import { SECRETS } from '@libs/secrets/shared/secrets/registry';
import { validateSecretOrError } from '@libs/secrets/shared/secrets/secret';
import { exportSecretsMapLive } from '@libs/secrets/shared/secrets/secrets-io';
import { Then } from './define';
import type { LiveWorld } from './live-world';

const STORED = 'stored-secrets';

/** This environment's secrets, exported from the secret store once per scenario. */
async function stored(w: LiveWorld): Promise<ReadonlyMap<string, string>> {
  const memo = w.memo.get(STORED) as ReadonlyMap<string, string> | undefined;
  if (memo !== undefined) return memo;
  const exported = await exportSecretsMapLive(w.env.env);
  expect(exported.size).toBeGreaterThan(0);
  w.memo.set(STORED, exported);
  return exported;
}

function valueOf(secrets: ReadonlyMap<string, string>, name: string): string {
  return secrets.get(name)?.trim() ?? '';
}

/** Every required secret is present. */
Then('the app has access to every service it relies on', async (w) => {
  const secrets = await stored(w);
  const missing = SECRETS.filter(
    (secret) => !secret.optional && valueOf(secrets, secret.name).length === 0
  ).map((secret) => secret.name);
  expect(missing, `missing in ${w.env.env}`).toEqual([]);
});

/** Every present secret passes its live validation. */
Then('every service the app relies on still accepts it', async (w) => {
  const secrets = await stored(w);
  const invalid: string[] = [];
  for (const secret of SECRETS) {
    const value = valueOf(secrets, secret.name);
    if (value.length === 0) continue;
    const error = await validateSecretOrError(secret, {
      env: w.env,
      secretValue: value,
      secrets,
    });
    if (error !== null) invalid.push(`${secret.name}: ${String(error)}`);
  }
  expect(invalid).toEqual([]);
});
