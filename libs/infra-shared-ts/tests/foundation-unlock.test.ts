import { expect, test } from 'bun:test';
import { foundationUnlockEnvironment } from '@libs/infra-shared-ts/foundation-unlock';

const paths = { tofuDir: '/tofu', cacheDir: '/cache' };

// regression: tofu-foundation-abandoned-lock
test('foundation unlock uses only the encrypted state backend credentials', () => {
  const { env, missing } = foundationUnlockEnvironment(
    {
      TOFU_STATE_PASSPHRASE: 'passphrase',
      TOFU_STATE_ACCESS_KEY_ID: 'state-key',
      TOFU_STATE_SECRET_ACCESS_KEY: 'state-secret',
    },
    paths,
    'dev'
  );
  expect(missing).toEqual([]);
  expect(env['AWS_ACCESS_KEY_ID']).toBe('state-key');
  expect(env['AWS_SECRET_ACCESS_KEY']).toBe('state-secret');
  expect(env['TF_VAR_state_passphrase']).toBe('passphrase');
  expect(env['TF_VAR_infisical_token']).toBe('');
  expect(env['TF_VAR_aws_access_key_id']).toBe('');
  expect(env['TF_DATA_DIR']).toBe('/cache/data/foundation-dev');
});

test('foundation unlock names every missing state credential', () => {
  const { missing } = foundationUnlockEnvironment({}, paths, 'dev');
  expect(missing).toEqual([
    'TOFU_STATE_PASSPHRASE',
    'TOFU_STATE_ACCESS_KEY_ID',
    'TOFU_STATE_SECRET_ACCESS_KEY',
  ]);
});
