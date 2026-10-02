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
  ROOM_CLASS,
  ROOM_MIGRATION_TAG,
  roomMigration,
} from '@libs/infra/public/worker-lifecycle';
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
  test('adopts existing room storage and retains subsequent migration history', () => {
    for (const env of Object.values(ENV_FILES)) {
      const source = env.worker.transfer_rooms_from;
      if (source === undefined)
        throw new Error('Expected existing environment room Worker');
      const migration = roomMigration(env, [
        { id: 'existing-data', script: source, class: ROOM_CLASS },
      ]);
      const later = { tag: 'v2-other-room', new_sqlite_classes: ['OtherRoom'] };
      const rendered = renderWranglerConfig(
        {
          ...base,
          migrations: [...(base['migrations'] as readonly unknown[]), later],
        },
        env,
        { roomMigration: migration }
      );
      expect(rendered['migrations']).toEqual([migration, later]);
      expect(migration).toEqual({
        tag: ROOM_MIGRATION_TAG,
        transferred_classes: [
          { from: ROOM_CLASS, from_script: source, to: ROOM_CLASS },
        ],
      });
    }
  });
  test('never deletes a Durable Object class', () => {
    expect(deletedDurableObjectClasses(base)).toEqual([]);
  });

  test("renders for every environment under that environment's Worker name", () => {
    for (const env of Object.values(ENV_FILES)) {
      const rendered = renderWranglerConfig(base, env);
      expect(rendered['name']).toBe(workerName(env));
      expect(rendered['main']).toBe('../src/worker.ts');
      expect(rendered['assets']).toEqual({
        directory: '../dist',
        binding: 'ASSETS',
        not_found_handling: 'single-page-application',
        run_worker_first: ['/api', '/api/*'],
      });
      expect(rendered['triggers']).toEqual({ crons: ['*/1 * * * *'] });
      expect(rendered['durable_objects']).toEqual({
        bindings: [
          {
            name: 'ROOM',
            class_name: 'RoomServerDurableObject',
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
      const vars = renderWranglerConfig(base, env)['vars'] as Record<
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
      const vars = renderWranglerConfig(base, env)['vars'] as Record<
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
        renderWranglerConfig(base, env, { hyperdriveId })['hyperdrive']
      ).toEqual([{ binding: HYPERDRIVE_BINDING, id: hyperdriveId }]);
      expect(renderWranglerConfig(base, env)['hyperdrive']).toBe(undefined);
    }
  });
});
