import { expect, test } from 'bun:test';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertProductionBundlesAtDir } from '@libs/client-config/shared/production-client-bundle-guard';
import { runPackageScriptOnce } from '@libs/integration-test/harness';
import { assert } from '@pkgs/assert';

/**
 * Native bundle-export smoke. Runs the SAME Metro bundling step `eas update`
 * performs (`bun run prebuild` + `expo export` for ios + android, via the
 * `@apps/client check:export:native` script) and asserts it produces native JS
 * bundles. This catches import / module-resolution / transform errors that
 * blank-screen the deployed OTA before it ever reaches a device — the web
 * export the browser E2E job builds cannot surface native-only bundling failures.
 *
 * Also scans the exported bundles for an inlined loopback `EXPO_PUBLIC_API_URL`
 * so a misconfigured OTA publish cannot ship (see `production-client-bundle-guard`).
 *
 * Env mirrors `apps/client/eas.json` `base` profile + `easEnv()` in
 * `libs/infra/src/cli/lib/eas-mobile.ts` so we bundle the real release code
 * with the real release env.
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
    assert.ok(
      parent !== dir,
      'native bundle smoke: turbo.json not found when walking up from test'
    );
    dir = parent;
  }
}

const OUTPUT_DIR = join(resolveWorkspaceRoot(), 'apps/client/.check-native');

function listFilesRecursive(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' });
}

function hasNativeBundle(files: readonly string[], platform: string): boolean {
  const jsPrefix = join('_expo', 'static', 'js', platform);
  return files.some(
    (f) => f.includes(jsPrefix) && (f.endsWith('.hbc') || f.endsWith('.js'))
  );
}

test(
  'native (ios + android) bundle exports without errors',
  async () => {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });

    await runPackageScriptOnce('@apps/client', 'check:export:native', {
      ...PRODUCTION_CLIENT_ENV,
    });

    expect(existsSync(OUTPUT_DIR)).toBe(true);
    const files = listFilesRecursive(OUTPUT_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(hasNativeBundle(files, 'android')).toBe(true);
    expect(hasNativeBundle(files, 'ios')).toBe(true);
    assertProductionBundlesAtDir(OUTPUT_DIR, 'production native export');
  },
  { timeout: 600_000 }
);
