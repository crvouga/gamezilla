import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  flattenVerifyAggregators,
  rootExcludeFiltersFor,
} from './turbo-ci-run';

// regression: default-commands-require-xcode
test.each(['verify', 'verify-nightly', 'lint'])(
  '%s leaves reference Swift packages out of the default task plan',
  (command) => {
    const filters = rootExcludeFiltersFor(flattenVerifyAggregators([command]));
    expect(filters).toContain('--filter=!@pkgs/clock-shared-swift');
    expect(filters).toContain('--filter=!@apps/client-swift');
  }
);

test('explicit native host verification remains available', () => {
  expect(
    rootExcludeFiltersFor(flattenVerifyAggregators(['verify:macos']))
  ).toEqual([]);
});

test('default formatting needs no Swift toolchain; explicit Swift formatting remains', () => {
  const root = join(import.meta.dirname, '../../..');
  const manifest = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8')
  ) as { scripts: Record<string, string> };
  const scripts = manifest.scripts;
  expect(scripts['fmt']).not.toContain('fmt:swift');
  expect(scripts['fmt:swift']).toBeDefined();
});
