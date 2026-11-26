import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envOrigins } from '@libs/infra-shared-ts/env-file';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import {
  renderAdminWranglerConfig,
  type WranglerConfig,
} from '@libs/infra-shared-ts/wrangler';

const config = Bun.TOML.parse(
  readFileSync(
    join(import.meta.dirname, '../../../apps/admin-api-ts/wrangler.toml'),
    'utf8'
  )
) as WranglerConfig;

describe('admin deployment', () => {
  for (const env of Object.values(ENV_FILES)) {
    test(`${env.env} serves admin assets and OAuth on its own Worker`, () => {
      const origin = envOrigins(env).admin;
      const rendered = renderAdminWranglerConfig(config, env, 'database-id');
      expect(rendered['name']).toBe(env.worker.admin_name);
      expect(rendered['name']).not.toBe(env.worker.name);
      expect(rendered['main']).toBe('../src/worker.ts');
      expect(rendered['assets']).toEqual({
        directory: '../../admin-client-ts/dist',
        binding: 'ASSETS',
        not_found_handling: 'single-page-application',
        run_worker_first: true,
      });
      expect(rendered['vars']).toMatchObject({
        API_URL: origin,
        WEB_CLIENT_ORIGIN: origin,
        WEB_CLIENT_APEX_ORIGIN: origin,
        OAUTH_STATE_TAG: `admin-${env.env}`,
        ADMIN_ACCOUNT_IDS: JSON.stringify(env.worker.admin_account_ids),
      });
      expect(rendered['hyperdrive']).toEqual([
        { binding: 'HYPERDRIVE', id: 'database-id' },
      ]);
      expect(rendered['triggers']).toEqual({ crons: ['* * * * *'] });
      expect(rendered['durable_objects']).toBeUndefined();
    });
  }
});
