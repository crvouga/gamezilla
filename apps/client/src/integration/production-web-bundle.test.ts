import { expect, test } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertProductionBundlesAtDir } from '@libs/client-config/shared/production-client-bundle-guard';
import { runPackageScriptOnce } from '@libs/integration-test/harness';

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
  EXPO_PUBLIC_API_URL: 'https://www.gamezilla.app',
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

test(
  'production web export inlines the production API origin',
  async () => {
    rmSync(DIST_DIR, { recursive: true, force: true });

    await runPackageScriptOnce('@apps/client', 'build', {
      ...PRODUCTION_CLIENT_ENV,
    });

    expect(existsSync(DIST_DIR)).toBe(true);
    assertProductionBundlesAtDir(DIST_DIR, 'production web dist');
  },
  { timeout: 600_000 }
);
