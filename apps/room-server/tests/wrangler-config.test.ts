import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILES } from '@libs/infra/public/envs';
import {
  deletedDurableObjectClasses,
  renderWranglerConfig,
  type WranglerConfig,
  workerName,
} from '@libs/infra/public/wrangler';

const base = Bun.TOML.parse(
  readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8')
) as WranglerConfig;

describe('wrangler.toml', () => {
  test('never deletes a Durable Object class', () => {
    expect(deletedDurableObjectClasses(base)).toEqual([]);
  });

  test("renders for every environment under that environment's Worker name", () => {
    for (const env of Object.values(ENV_FILES)) {
      const rendered = renderWranglerConfig(base, env, 'room');
      expect(rendered['name']).toBe(workerName(env, 'room'));
    }
  });

  // `src/room.ts` requires observability credentials only when this var says
  // `production`; it is the Worker's only source of production-ness.
  test('carries every environment its env file protection', () => {
    for (const env of Object.values(ENV_FILES)) {
      const vars = renderWranglerConfig(base, env, 'room')['vars'] as Record<
        string,
        string
      >;
      expect(vars['DEPLOYMENT_PROTECTION']).toBe(env.protection);
    }
  });
});
