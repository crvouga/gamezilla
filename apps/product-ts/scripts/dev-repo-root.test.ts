import { describe, expect, test } from 'bun:test';
import { join, resolve } from 'node:path';

import { resolveDevRepoRoot } from './dev-repo-root';

describe('development repository root', () => {
  test('survives moving the launcher within the product scripts', () => {
    // regression: bun-dev-repo-root-after-script-move
    // regression: dev-prepare-stale-manifest
    // `resolve` gives the host's absolute form (`C:\Users\...` on Windows),
    // which is what the walk compares against.
    const repoRoot = resolve('/home/dev/repo');
    const markerFiles = new Set([
      join(repoRoot, 'package.json'),
      join(repoRoot, 'turbo.json'),
      join(repoRoot, 'apps/product-ts/package.json'),
    ]);

    expect(
      resolveDevRepoRoot(join(repoRoot, 'apps/product-ts/scripts'), (path) =>
        markerFiles.has(path)
      )
    ).toBe(repoRoot);
  });
});
