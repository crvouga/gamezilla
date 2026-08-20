import { expect, test } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProductionBundleGuard } from '@libs/client-config/public/production-client-bundle-guard';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store/wall-node-fs';
import { wallPathExists } from '@pkgs/sim-console';

import { runPackageScriptOnce } from './run-package-script-once';

/**
 * Production web export gate. Builds the same `expo export -p web` artifact
 * `infra deploy` ships inside the Worker (`buildClientForWorker`) and scans
 * the JS bundles for an inlined loopback `EXPO_PUBLIC_API_URL`.
 *
 * Browser E2E intentionally exports with a localhost API URL for Playwright;
 * this test is the only CI job that must produce a production-API web bundle
 * before `deploy` runs.
 */

const PRODUCTION_CLIENT_ENV = {
  EXPO_PUBLIC_API_URL: 'https://api.gamezilla.app',
  EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL: '1',
} as const;

function resolveWorkspaceRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, 'turbo.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('turbo.json not found when walking up from test');
    }
    dir = parent;
  }
}

const DIST_DIR = join(resolveWorkspaceRoot(), 'apps/client/dist');
const fs = wallNodeFs();

test(
  'production web export inlines the production API origin',
  async () => {
    rmSync(DIST_DIR, { recursive: true, force: true });

    await runPackageScriptOnce(
      '@apps/client',
      'build',
      {
        ...PRODUCTION_CLIENT_ENV,
      },
      wallPathExists
    );

    expect(existsSync(DIST_DIR)).toBe(true);
    await new ProductionBundleGuard(
      createNodeFsObjectStore({ rootDir: DIST_DIR, fs, layout: 'tree' })
    ).assert('production web dist');
  },
  { timeout: 600_000 }
);
