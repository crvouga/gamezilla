import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECURITY_CONTACT } from '@libs/app-root-shared-ts/app-metadata';
import { WEB_CLIENT_ORIGIN_BINDING } from '@libs/app-root-shared-ts/auth-provider';
import {
  BILLING_PROVIDER_BINDING,
  DEPLOYMENT_PROTECTION_BINDING,
  readDeploymentProtection,
} from '@libs/app-root-shared-ts/env';
import {
  authRelayOrigin,
  envOrigins,
  isProductionEnv,
  parseEnvFile,
} from '@libs/infra-shared-ts/env-file';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import {
  ROOM_ARCHIVE_CLASS,
  ROOM_ARCHIVE_TAG,
  ROOM_CLASS,
  ROOM_MIGRATION_TAG,
  ROOM_TRANSFER_TAG,
  roomMigrations,
} from '@libs/infra-shared-ts/worker-lifecycle';
import type { WranglerConfig } from '@libs/infra-shared-ts/wrangler';
import {
  databasePlacement,
  deletedDurableObjectClasses,
  HYPERDRIVE_BINDING,
  renderWranglerConfig,
  workerName,
} from '@libs/infra-shared-ts/wrangler';
import { IDENTITY_PLACEHOLDERS } from '@libs/product-identity-shared-ts/identity-placeholders';
import { getApiWorkerSecrets } from '@libs/secrets-server-ts/registry';
import { INHOUSE_AUTH_SECRET } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-config';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { workerSecretPayload } from '../scripts/worker-secrets';

const base = Bun.TOML.parse(
  readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8')
) as WranglerConfig;

describe('wrangler.toml', () => {
  test('replica endpoints follow its declared hosts regardless of copied vars', () => {
    assertProperty(
      'replica endpoint bindings follow the declared hosts',
      fc.property(fc.stringMatching(/^[a-z][a-z0-9]{0,12}$/), (label) => {
        const env = parseEnvFile(
          {
            ...ENV_FILES['dev'],
            hosts: {
              apex: `${label}.example.test`,
              web: `web-${label}.example.test`,
              api: `api-${label}.example.test`,
              broker: `broker-${label}.example.test`,
            },
          },
          'replica endpoint property'
        );
        const vars = renderWranglerConfig(
          { ...base, vars: { API_URL: 'https://dev-api.stale.example' } },
          env
        )['vars'] as Record<string, string>;
        expect(vars['API_URL']).toBe(`https://api-${label}.example.test`);
        expect(vars['WEB_CLIENT_ORIGIN']).toBe(
          `https://web-${label}.example.test`
        );
        expect(vars['WEB_CLIENT_APEX_ORIGIN']).toBe(
          `https://${label}.example.test`
        );
        expect(vars['EMQX_WSS_URL']).toBe(
          `wss://broker-${label}.example.test/mqtt`
        );
      })
    );
  });
  // regression: dev-client-stale-api-config
  test('copied endpoint settings cannot override the environment endpoints', () => {
    const copied = Object.fromEntries(
      getApiWorkerSecrets().map((entry) => [entry.name, 'fixture-value'])
    );
    copied['API_URL'] = 'https://dev-api.stale.example';
    copied['EMQX_WSS_URL'] = 'wss://obsolete-broker.stale.example/mqtt';
    const stale = {
      ...base,
      vars: {
        API_URL: copied['API_URL'],
        EMQX_WSS_URL: copied['EMQX_WSS_URL'],
        WEB_CLIENT_ORIGIN: 'https://obsolete-client.stale.example',
      },
    };
    for (const env of Object.values(ENV_FILES)) {
      const secrets = workerSecretPayload(env, copied);
      const vars = renderWranglerConfig(stale, env)['vars'] as Record<
        string,
        string
      >;
      expect(vars['API_URL']).toBe(envOrigins(env).api);
      expect(vars['EMQX_WSS_URL']).toBe(`wss://${env.hosts.broker}/mqtt`);
      expect(vars['WEB_CLIENT_ORIGIN']).toBe(envOrigins(env).web);
      expect(vars['WEB_CLIENT_APEX_ORIGIN']).toBe(envOrigins(env).apex);
      expect(secrets['API_URL']).toBeUndefined();
      expect(secrets['EMQX_WSS_URL']).toBeUndefined();
      expect(secrets['SECRETS_ENV']).toBe(env.env);
    }
  });
  // regression: api-worker-far-from-its-database
  test('the API Worker runs in the cloud region of its database', () => {
    expect(GLOBAL.planetscale.region).toBe('us-east');
    for (const env of Object.values(ENV_FILES)) {
      expect(renderWranglerConfig(base, env)['placement']).toEqual({
        region: 'aws:us-east-1',
      });
    }
    expect(databasePlacement('us-west')).toEqual({ region: 'aws:us-west-2' });
  });
  test('a database region without a known cloud region fails the render', () => {
    expect(() => databasePlacement('mars-north')).toThrow('mars-north');
  });
  test('placement is not committed beside the code config', () => {
    expect(base['placement']).toBeUndefined();
    expect(() =>
      renderWranglerConfig(
        { ...base, placement: { mode: 'smart' } },
        ENV_FILES['dev']!
      )
    ).toThrow('placement');
  });
  // regression: deploy-dev-duplicate-room-namespaces
  test('renders the ordered retention and transfer steps for the pinned dev conflict', () => {
    const dev = ENV_FILES['dev'];
    if (dev === undefined) throw new Error('Development environment missing');
    const resolution = dev.worker.room_namespace_resolution;
    if (resolution === undefined) throw new Error('Resolution missing');
    const migrations = roomMigrations(dev, [
      { id: resolution.target_id, script: dev.worker.name, class: ROOM_CLASS },
      {
        id: resolution.source_id,
        script: dev.worker.transfer_rooms_from ?? '',
        class: ROOM_CLASS,
      },
    ]);
    const rendered = renderWranglerConfig(base, dev, {
      roomMigrations: migrations,
    });
    expect(rendered['migrations']).toEqual(migrations);
    expect(migrations[1]).toEqual({
      tag: ROOM_ARCHIVE_TAG,
      renamed_classes: [{ from: ROOM_CLASS, to: ROOM_ARCHIVE_CLASS }],
    });
    expect(migrations[2]?.tag).toBe(ROOM_TRANSFER_TAG);
    expect(deletedDurableObjectClasses(rendered)).toEqual([]);
    expect(() =>
      renderWranglerConfig(
        { ...base, migrations: [{ tag: ROOM_MIGRATION_TAG }] },
        dev,
        { roomMigrations: migrations }
      )
    ).toThrow('missing from the committed config');
  });
  test('adopts existing room storage and retains subsequent migration history', () => {
    for (const env of Object.values(ENV_FILES)) {
      const source = env.worker.transfer_rooms_from;
      if (source === undefined)
        throw new Error('Expected existing environment room Worker');
      const migration = roomMigrations(env, [
        { id: 'existing-data', script: source, class: ROOM_CLASS },
      ]);
      const later = { tag: 'v2-other-room', new_sqlite_classes: ['OtherRoom'] };
      const rendered = renderWranglerConfig(
        {
          ...base,
          migrations: [...(base['migrations'] as readonly unknown[]), later],
        },
        env,
        { roomMigrations: migration }
      );
      expect(rendered['migrations']).toEqual([
        ...migration,
        ...(base['migrations'] as readonly { tag: string }[]).slice(1),
        later,
      ]);
      expect(migration).toEqual([
        {
          tag: ROOM_MIGRATION_TAG,
          transferred_classes: [
            { from: ROOM_CLASS, from_script: source, to: ROOM_CLASS },
          ],
        },
      ]);
    }
  });
  test('never deletes a Durable Object class', () => {
    expect(deletedDurableObjectClasses(base)).toEqual([]);
  });

  // regression: production-cron-registration-stalled
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
      expect(rendered['triggers']).toEqual({ crons: ['* * * * *'] });
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

  test('the committed config leaves names to the identity, and no placeholder ships', () => {
    expect(base['name']).toBe('{namespace}');
    for (const env of Object.values(ENV_FILES)) {
      const rendered = JSON.stringify(renderWranglerConfig(base, env));
      for (const name of IDENTITY_PLACEHOLDERS)
        expect({
          env: env.env,
          placeholder: rendered.includes(`{${name}}`),
        }).toEqual({ env: env.env, placeholder: false });
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

describe('security.txt', () => {
  // regression: security-report-route-missing
  test('the shipped assets name the security contact (RFC 9116)', () => {
    const text = readFileSync(
      join(import.meta.dirname, '../public/.well-known/security.txt'),
      'utf8'
    );
    const fields = new Map(
      text
        .trim()
        .split('\n')
        .map((line) => {
          const at = line.indexOf(': ');
          return [line.slice(0, at), line.slice(at + 2)] as const;
        })
    );
    expect(fields.get('Contact')).toBe(`mailto:${SECURITY_CONTACT}`);
    const expires = fields.get('Expires') ?? '';
    expect(new Date(expires).toISOString()).toBe(expires);
  });
});
