import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  authRelayOrigin,
  envOrigins,
  isProductionEnv,
  parseEnvFile,
} from '@libs/infra/public/env-file';
import { ENV_FILES } from '@libs/infra/public/envs';
import {
  deletedDurableObjectClasses,
  HYPERDRIVE_BINDING,
  renderWranglerConfig,
  type WranglerConfig,
  workerName,
} from '@libs/infra/public/wrangler';
import { WEB_CLIENT_ORIGIN_BINDING } from '@libs/server-app/config/auth-provider';
import {
  BILLING_PROVIDER_BINDING,
  DEPLOYMENT_PROTECTION_BINDING,
  readDeploymentProtection,
} from '@libs/server-app/config/env';
import { INHOUSE_AUTH_SECRET } from '@pkgs/auth-inhouse/server';

const base = Bun.TOML.parse(
  readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8')
) as WranglerConfig;

describe('wrangler.toml', () => {
  test('never deletes a Durable Object class', () => {
    expect(deletedDurableObjectClasses(base)).toEqual([]);
  });

  test("renders for every environment under that environment's Worker name", () => {
    for (const env of Object.values(ENV_FILES)) {
      const rendered = renderWranglerConfig(base, env, 'api');
      expect(rendered['name']).toBe(workerName(env, 'api'));
      expect(rendered['durable_objects']).toEqual({
        bindings: [
          {
            name: 'ROOM',
            class_name: 'RoomServerDurableObject',
            script_name: workerName(env, 'room'),
          },
        ],
      });
    }
  });

  test('boots every environment knowing whether it is production from its env file, not its name', () => {
    const staging = parseEnvFile(
      {
        ...ENV_FILES['dev'],
        env: 'staging',
        protection: 'standard',
      },
      'synthetic staging.tfvars.json'
    );
    for (const env of [...Object.values(ENV_FILES), staging]) {
      const vars = renderWranglerConfig(base, env, 'api')['vars'] as Record<
        string,
        string
      >;
      expect(vars[DEPLOYMENT_PROTECTION_BINDING]).toBe(env.protection);
      expect(readDeploymentProtection(vars)).toBe(env.protection);
      expect(readDeploymentProtection(vars) === 'production').toBe(
        isProductionEnv(env)
      );
    }
  });

  test('a Worker with no rendered protection (wrangler dev, localhost stack) is not production', () => {
    expect(readDeploymentProtection({})).toBe('standard');
    expect(() =>
      readDeploymentProtection({ DEPLOYMENT_PROTECTION: 'prd' })
    ).toThrow(/production" or "standard/);
  });

  test('boots every environment with its web origin and the shared OAuth relay', () => {
    for (const env of Object.values(ENV_FILES)) {
      const vars = renderWranglerConfig(base, env, 'api')['vars'] as Record<
        string,
        string
      >;
      expect(vars[WEB_CLIENT_ORIGIN_BINDING]).toBe(envOrigins(env).web);
      expect(vars[BILLING_PROVIDER_BINDING]).toBe(env.billing.provider);
      expect(vars[INHOUSE_AUTH_SECRET.oauthCallbackOrigin]).toBe(
        authRelayOrigin()
      );
      expect(vars[INHOUSE_AUTH_SECRET.oauthStateTag]).toBe(env.env);
    }
  });

  test("binds the environment's Hyperdrive config as HYPERDRIVE", () => {
    for (const env of Object.values(ENV_FILES)) {
      const hyperdriveId = '0123456789abcdef0123456789abcdef';
      expect(
        renderWranglerConfig(base, env, 'api', { hyperdriveId })['hyperdrive']
      ).toEqual([{ binding: HYPERDRIVE_BINDING, id: hyperdriveId }]);
      expect(renderWranglerConfig(base, env, 'api')['hyperdrive']).toBe(
        undefined
      );
    }
  });
});
