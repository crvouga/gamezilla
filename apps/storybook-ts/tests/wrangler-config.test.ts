import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import type { WranglerConfig } from '@libs/infra-shared-ts/wrangler';
import { renderStorybookWranglerConfig } from '@libs/infra-shared-ts/wrangler';

const base = Bun.TOML.parse(
  readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8')
) as WranglerConfig;
const rendered = renderStorybookWranglerConfig(base);

describe('Storybook site Worker', () => {
  test('deploys under the one global name', () => {
    expect(rendered['name']).toBe(GLOBAL.storybook.worker);
  });

  test('serves the canonical Storybook build from the rendered config directory', () => {
    // The rendered config lives in `<app>/.cache/`, one level below the TOML.
    expect(rendered['assets']).toEqual({
      directory: '../../../pkgs/ui-root-harness-ts/.cache/storybook',
      not_found_handling: 'none',
    });
  });

  test('runs no Worker script, binds no hostname and has no workers.dev URL', () => {
    expect(rendered['main']).toBeUndefined();
    expect(rendered['routes']).toBeUndefined();
    expect(rendered['workers_dev']).toBe(false);
    expect(rendered['preview_urls']).toBe(false);
  });

  test('refuses a Worker script', () => {
    expect(() =>
      renderStorybookWranglerConfig({ ...base, main: 'src/worker.ts' })
    ).toThrow('assets-only');
  });
});
