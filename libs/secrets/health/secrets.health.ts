// @io-wall-ok — live health probe (Infisical export + every vendor credential).
import { describe, expect, test } from 'bun:test';
import { SECRETS } from '@libs/secrets/shared/secrets/registry';
import {
  activeEnvFile,
  validateSecretOrError,
} from '@libs/secrets/shared/secrets/secret';
import { exportSecretsMapLive } from '@libs/secrets/shared/secrets/secrets-io';

/**
 * Unlike the fingerprint-cached `@libs/secrets#check`, this re-runs every
 * registry `validate` live, so a revoked key or suspended vendor account shows
 * up between deploys.
 */
describe(`secrets (${activeEnvFile().env})`, () => {
  const env = activeEnvFile();
  let stored: ReadonlyMap<string, string> = new Map();

  test('secret store exports this env', async () => {
    stored = await exportSecretsMapLive(env.env);
    expect(stored.size).toBeGreaterThan(0);
  });

  for (const secret of SECRETS) {
    test(secret.name, async () => {
      const value = stored.get(secret.name)?.trim() ?? '';
      if (value.length === 0) {
        expect(secret.optional, `${secret.name} missing in ${env.env}`).toBe(
          true
        );
        return;
      }
      const error = await validateSecretOrError(secret, {
        env,
        secretValue: value,
        secrets: stored,
      });
      expect(error).toBeNull();
    });
  }
});
