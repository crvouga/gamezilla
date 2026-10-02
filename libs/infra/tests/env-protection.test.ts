import { describe, expect, test } from 'bun:test';
import {
  apiWorkerVars,
  authRelayTargets,
  type EnvFile,
  isProductionEnv,
  parseEnvFile,
  productionEnvNames,
  sharedIdentities,
} from '@libs/infra/public/env-file';
import { ENV_FILES, PRODUCTION_ENV_NAMES } from '@libs/infra/public/envs';
import { renderWranglerConfig } from '@libs/infra/public/wrangler';

/**
 * A third environment nobody wrote code for: only its env file. Everything
 * that decides production-ness must read `protection`, not the name.
 */
function syntheticEnv(
  name: string,
  protection: EnvFile['protection']
): EnvFile {
  return parseEnvFile(
    {
      env: name,
      display_name: `Synthetic ${name}`,
      suffix: `${name}-synthetic`,
      worker: { name: `app-${name}` },
      protection,
      cloudflare: { account_id: 'acct', zone_name: 'example.test' },
      hosts: {
        apex: `${name}.example.test`,
        web: `www-${name}.example.test`,
        api: `api-${name}.example.test`,
        broker: `emqx-${name}.example.test`,
      },
      billing: { provider: 'stripe' },
    },
    `synthetic ${name}.tfvars.json`
  );
}

describe('environment protection', () => {
  const staging = syntheticEnv('staging', 'standard');
  const envs = [...Object.values(ENV_FILES), staging];

  test('a new standard env file is not production, whatever its name', () => {
    expect(isProductionEnv(staging)).toBe(false);
    expect(isProductionEnv(syntheticEnv('prd-mirror', 'standard'))).toBe(false);
    expect(isProductionEnv(syntheticEnv('dev-live', 'production'))).toBe(true);
    expect(productionEnvNames(envs)).toEqual(PRODUCTION_ENV_NAMES);
  });

  test('production is exactly the env files whose protection says so', () => {
    expect([...PRODUCTION_ENV_NAMES].sort()).toEqual(
      Object.values(ENV_FILES)
        .filter((env) => env.protection === 'production')
        .map((env) => env.env)
        .sort()
    );
  });

  test('a new env file is reachable through the OAuth relay and shares no identity', () => {
    expect(authRelayTargets(envs)['staging']).toBe(
      'https://api-staging.example.test'
    );
    expect(sharedIdentities(envs)).toEqual([]);
    expect(apiWorkerVars(staging)['OAUTH_STATE_TAG']).toBe('staging');
  });

  test('every rendered Worker carries its env file protection', () => {
    for (const env of envs) {
      const vars = renderWranglerConfig({ main: 'src/index.ts' }, env)[
        'vars'
      ] as Record<string, string>;
      expect({
        env: env.env,
        protection: vars['DEPLOYMENT_PROTECTION'],
      }).toEqual({
        env: env.env,
        protection: env.protection,
      });
      expect(vars['DEPLOYMENT_ENVIRONMENT']).toBe(env.env);
    }
  });

  test('the committed config cannot override the rendered protection', () => {
    const vars = renderWranglerConfig(
      { vars: { DEPLOYMENT_PROTECTION: 'production' } },
      staging
    )['vars'] as Record<string, string>;
    expect(vars['DEPLOYMENT_PROTECTION']).toBe('standard');
  });
});
