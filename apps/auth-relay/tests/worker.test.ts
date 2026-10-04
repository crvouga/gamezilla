import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import worker from '@apps/auth-relay/worker';
import { authRelayOrigin, envOrigins } from '@libs/infra-shared/env-file';
import { ENV_FILES } from '@libs/infra-shared/envs';
import { GLOBAL } from '@libs/infra-shared/global';
import type { WranglerConfig } from '@libs/infra-shared/wrangler';
import { renderAuthRelayWranglerConfig } from '@libs/infra-shared/wrangler';

const base = Bun.TOML.parse(
  readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8')
) as WranglerConfig;
const rendered = renderAuthRelayWranglerConfig(base);
const vars = rendered['vars'] as Record<string, string>;
const CALLBACK = `${authRelayOrigin()}/api/auth/callback/google`;

describe('auth relay Worker', () => {
  test('deploys under the one global name', () => {
    expect(rendered['name']).toBe(GLOBAL.auth_relay.worker);
  });

  test("returns every environment's Google sign-ins to that environment", async () => {
    for (const env of Object.values(ENV_FILES)) {
      const res = await worker.fetch(
        new Request(`${CALLBACK}?code=c&state=${env.env}.s1`),
        vars
      );
      expect({ env: env.env, status: res.status }).toEqual({
        env: env.env,
        status: 302,
      });
      expect(res.headers.get('location')).toBe(
        `${envOrigins(env).api}/api/auth/callback/google?code=c&state=${env.env}.s1`
      );
    }
  });

  test('refuses a callback no environment started', async () => {
    const res = await worker.fetch(
      new Request(`${CALLBACK}?code=c&state=nobody.s1`),
      vars
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  test('serves nothing but the callback', async () => {
    const res = await worker.fetch(
      new Request(`${authRelayOrigin()}/api/health`),
      vars
    );
    expect(res.status).toBe(404);
  });
});
