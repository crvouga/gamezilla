import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { resolveDevRepoRoot } from './dev-repo-root';

describe('development repository root', () => {
  test('survives moving the launcher within the product scripts', () => {
    // regression: bun-dev-repo-root-after-script-move
    // regression: dev-prepare-stale-manifest
    const repoRoot = '/Users/chrisvouga/gamezilla';
    const markerFiles = new Set([
      join(repoRoot, 'package.json'),
      join(repoRoot, 'turbo.json'),
      join(repoRoot, 'apps/product/package.json'),
    ]);

    expect(
      resolveDevRepoRoot(
        '/Users/chrisvouga/gamezilla/apps/product/scripts',
        (path) => markerFiles.has(path)
      )
    ).toBe(repoRoot);
  });
});
