import { describe, expect, test } from 'bun:test';
import type { AwsSession } from '@libs/infra-shared/aws-session';
import {
  missingSecretsMessage,
  tofuEnvironment,
} from '@libs/infra-shared/tofu-command';

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

  test('reports AWS_ROLE_ARN missing when neither a session nor a key is set', () => {
    const { env, missing } = tofuEnvironment(baseSecrets(), PATHS, foundation);
    expect(missing).toEqual(['AWS_ROLE_ARN']);
    expect(env['TF_VAR_aws_access_key_id']).toBeUndefined();
    expect(missingSecretsMessage('foundation', missing)).toContain(
      'set AWS_ROLE_ARN'
    );
  });

  test('a passed session fills the provider vars and leaves the state key', () => {
    const session: AwsSession = {
      accessKeyId: 'ASIAEXAMPLE',
      secretAccessKey: 'session-secret',
      sessionToken: 'session-token',
    };
    const { env, missing } = tofuEnvironment(
      {
        ...baseSecrets(),
        AWS_ACCOUNT_ACCESS_KEY_ID: 'account-id',
        AWS_ACCOUNT_SECRET_ACCESS_KEY: 'account-secret',
      },
      PATHS,
      foundation,
      session
    );
    expect(missing).toEqual([]);
    expect(env['AWS_ACCESS_KEY_ID']).toBe('state-id');
    expect(env['TF_VAR_aws_access_key_id']).toBe('ASIAEXAMPLE');
    expect(env['TF_VAR_aws_secret_access_key']).toBe('session-secret');
    expect(env['TF_VAR_aws_session_token']).toBe('session-token');
  });

  test('passes a session token that arrived with the account keys', () => {
    const { env } = tofuEnvironment(
      {
        ...baseSecrets(),
        AWS_ACCOUNT_ACCESS_KEY_ID: 'account-id',
        AWS_ACCOUNT_SECRET_ACCESS_KEY: 'account-secret',
        AWS_SESSION_TOKEN: 'account-token',
      },
      PATHS,
      foundation
    );
    expect(env['TF_VAR_aws_session_token']).toBe('account-token');
  });

  test('does not ask edge for AWS credentials', () => {
    const { missing } = tofuEnvironment(
      {
        TOFU_STATE_PASSPHRASE: 'pass',
        CLOUDFLARE_API_TOKEN: 'cf',
        TOFU_STATE_ACCESS_KEY_ID: 'state-id',
        TOFU_STATE_SECRET_ACCESS_KEY: 'state-secret',
      },
      PATHS,
      { stack: 'edge', env: 'dev' }
    );
    expect(missing).toEqual([]);
  });
});
