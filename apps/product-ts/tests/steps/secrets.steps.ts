// @io-wall-ok — live health: Infisical export and every vendor credential.
/**
 * `specs/runtime/connected-services.feature`. Unlike the fingerprint-cached
 * `@libs/secrets#check`, this re-runs every registry `validate` live, so a
 * revoked key or suspended vendor account shows up between deploys.
 */

import { expect } from 'bun:test';
import { SECRETS } from '@libs/secrets-server-ts/registry';
import { validateSecretOrError } from '@libs/secrets-shared-ts/secret';
import { Then } from './define';
import { liveSecrets } from './live-secrets';

function valueOf(secrets: ReadonlyMap<string, string>, name: string): string {
  return secrets.get(name)?.trim() ?? '';
}

/** Every required secret is present. */
Then(
  'the app has what it needs to use every outside service it relies on',
  async (w) => {
    const secrets = await liveSecrets(w);
    const missing = SECRETS.filter(
      (secret) => !secret.optional && valueOf(secrets, secret.name).length === 0
    ).map((secret) => secret.name);
    expect(missing, `missing in ${w.env.env}`).toEqual([]);
  }
);

/** Every present secret passes its live validation. */
Then(
  'every outside service the app relies on still lets the app use it',
  async (w) => {
    const secrets = await liveSecrets(w);
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
  }
);
