// @io-wall-ok — verifies the repository stores schemas/fixtures, never deployment identity.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { BRAND_ARTIFACTS } from '@libs/product-brand-shared-ts/brand-artifacts';
import { BRAND_IMAGE_ARTIFACTS } from './brand-image-catalog';

test('deployment identity and every branded build artifact are ignored and untracked', () => {
  // regression: committed-brand-rebuild
  const root = join(import.meta.dirname, '../../..');
  const paths = [
    'libs/product-identity/product-identity.json',
    'libs/infra-shared-ts/tofu/modules/observability-views/alert-rules.generated.json',
    'libs/infra-shared-ts/tofu/modules/observability-views/grafana-slos.generated.json',
    ...BRAND_ARTIFACTS.map(({ path }) => path),
    ...BRAND_IMAGE_ARTIFACTS.map(({ path }) => path),
  ];
  expect(
    execFileSync('git', ['ls-files', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  ).toBe('');
  const ignored = execFileSync('git', ['check-ignore', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n');
  expect(ignored.toSorted()).toEqual(paths.toSorted());
});
