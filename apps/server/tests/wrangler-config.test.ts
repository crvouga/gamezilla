import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envOrigins, oauthRelayEnv } from '@libs/infra/public/env-file';
import { ENV_FILES } from '@libs/infra/public/envs';
import {
  deletedDurableObjectClasses,
  renderWranglerConfig,
  type WranglerConfig,
  workerName,
} from '@libs/infra/public/wrangler';
import { WEB_CLIENT_ORIGIN_BINDING } from '@libs/server-app/config/auth-provider';
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

  test('boots every environment with its web origin and the shared OAuth callback', () => {
    const envs = Object.values(ENV_FILES);
    const relay = oauthRelayEnv(envs);
    for (const env of envs) {
      const vars = renderWranglerConfig(base, env, 'api')['vars'] as Record<
        string,
        string
      >;
      expect(vars[WEB_CLIENT_ORIGIN_BINDING]).toBe(envOrigins(env).web);
      expect(vars[INHOUSE_AUTH_SECRET.oauthCallbackOrigin]).toBe(
        envOrigins(relay).api
      );
      expect(vars[INHOUSE_AUTH_SECRET.oauthStateTag]).toBe(env.env);
      const targets = JSON.parse(
        vars[INHOUSE_AUTH_SECRET.oauthRelayTargets] ?? '{}'
      ) as Record<string, string>;
      expect(Object.keys(targets).sort()).toEqual(
        envs
          .filter((other) => other.env !== env.env)
          .map((other) => other.env)
          .sort()
      );
    }
  });
});
