import { describe, expect, test } from 'bun:test';
import { spawnedCliViolations } from './spawned-clis';

describe('spawnedCliViolations', () => {
  // regression: product-deploy-wrangler-not-on-path
  test('flags a script that spawns wrangler from a package that does not declare it', () => {
    expect(
      spawnedCliViolations({
        manifest: { devDependencies: { '@pkgs/os': 'workspace:*' } },
        sources: [
          {
            path: 'scripts/deploy.ts',
            text: "await runAsync('wrangler', wranglerDeployArgs, {",
          },
        ],
      })
    ).toEqual([
      'scripts/deploy.ts spawns `wrangler` but package.json does not declare "wrangler" (add "wrangler": "catalog:" to devDependencies)',
    ]);
  });

  test('a declared CLI, or one only mentioned, is clean', () => {
    expect(
      spawnedCliViolations({
        manifest: { devDependencies: { wrangler: 'catalog:' } },
        sources: [{ path: 'scripts/dev.ts', text: "spawn(\n  'wrangler',\n" }],
      })
    ).toEqual([]);
    expect(
      spawnedCliViolations({
        manifest: {},
        sources: [
          {
            path: 'src/a.ts',
            text: "// see wrangler.toml\nconst x = 'wrangler';",
          },
        ],
      })
    ).toEqual([]);
  });
});
