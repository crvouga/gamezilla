import { describe, expect, test } from 'bun:test';
import { tofuEnvironment } from '@libs/infra/public/tofu-command';

const PATHS = { tofuDir: '/tofu', cacheDir: '/cache' };
const foundation = { stack: 'foundation' as const, env: 'dev' };

function baseSecrets(): Record<string, string> {
  return {
    TOFU_STATE_PASSPHRASE: 'pass',
    CLOUDFLARE_API_TOKEN: 'cf',
    TOFU_STATE_ACCESS_KEY_ID: 'state-id',
    TOFU_STATE_SECRET_ACCESS_KEY: 'state-secret',
    PLANETSCALE_SERVICE_TOKEN_ID: 'ps-id',
    PLANETSCALE_SERVICE_TOKEN: 'ps-token',
    GRAFANA_CLOUD_API_TOKEN: 'graf',
  };
}

describe('tofuEnvironment', () => {
  test('keeps the R2 state keys in AWS_ACCESS_KEY_ID', () => {
    const { env, missing } = tofuEnvironment(
      {
        ...baseSecrets(),
        AWS_ACCOUNT_ACCESS_KEY_ID: 'account-id',
        AWS_ACCOUNT_SECRET_ACCESS_KEY: 'account-secret',
        AWS_ACCESS_KEY_ID: 'other-id',
        AWS_SECRET_ACCESS_KEY: 'other-secret',
      },
      PATHS,
      foundation
    );
    expect(missing).toEqual([]);
    expect(env['AWS_ACCESS_KEY_ID']).toBe('state-id');
    expect(env['AWS_SECRET_ACCESS_KEY']).toBe('state-secret');
    expect(env['TF_VAR_aws_access_key_id']).toBe('account-id');
    expect(env['TF_VAR_aws_secret_access_key']).toBe('account-secret');
    expect(env['PLANETSCALE_SERVICE_TOKEN_ID']).toBe('ps-id');
  });

  test('falls back to AWS_ACCESS_KEY_ID when the account name is empty', () => {
    const { env, missing } = tofuEnvironment(
      {
        ...baseSecrets(),
        AWS_ACCESS_KEY_ID: 'fallback-id',
        AWS_SECRET_ACCESS_KEY: 'fallback-secret',
      },
      PATHS,
      foundation
    );
    expect(missing).toEqual([]);
    expect(env['TF_VAR_aws_access_key_id']).toBe('fallback-id');
    expect(env['TF_VAR_aws_secret_access_key']).toBe('fallback-secret');
    expect(env['AWS_ACCESS_KEY_ID']).toBe('state-id');
  });

  test('reports the account names missing when neither key is set', () => {
    const { env, missing } = tofuEnvironment(baseSecrets(), PATHS, foundation);
    expect(missing).toContain('AWS_ACCOUNT_ACCESS_KEY_ID');
    expect(missing).toContain('AWS_ACCOUNT_SECRET_ACCESS_KEY');
    expect(env['TF_VAR_aws_access_key_id']).toBeUndefined();
  });
});
