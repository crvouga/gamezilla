import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { assert } from '@pkgs/assert';

// ---------------------------------------------------------------------------
// Dev-mode launch test config. This reproduces the Expo Go OTA white-screen:
// a `__DEV__ === true` web bundle (`expo export --dev`) hits the SAME
// `getApiBaseUrl()` Tiger-policy path Expo Go does. We deterministically pin
// the production API host + allow-flag — the exact env an OTA `eas update`
// publishes (`apps/client/eas.json` base + `easEnv()` in
// `libs/infra/src/cli/lib/eas-mobile.ts`) — because the Tiger guard only
// fires for the production host; a loopback origin would skip it and the test
// would never exercise the failing path.
// ---------------------------------------------------------------------------

const PRODUCTION_API_URL = 'https://www.gamezilla.app';

process.env['EXPO_PUBLIC_API_URL'] = PRODUCTION_API_URL;
process.env['EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL'] = '1';

assert.equals(
  process.env['EXPO_PUBLIC_API_URL'],
  PRODUCTION_API_URL,
  'EXPO_PUBLIC_API_URL must be the production host so the dev-bundle Tiger guard is exercised'
);
assert.equals(
  process.env['EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL'],
  '1',
  'EXPO_PUBLIC_ALLOW_PRODUCTION_API_URL must be set (mirrors the OTA publish env)'
);

assert.nonEmptyString(__dirname, '__dirname must resolve to a non-empty path');

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
assert.ok(
  existsSync(path.join(repoRoot, 'turbo.json')),
  'repoRoot must contain turbo.json (sanity check that path traversal landed at the monorepo root)',
  { repoRoot }
);

const port = 5174;
const baseURL = `http://localhost:${port}`;

// Build the dev-mode web bundle with the same `expo export` bundler + prebuild
// the release uses, then statically serve it. Done in the webServer command
// (not a separate CI step) so the test also runs locally with one command.
const exportAndServe = [
  'bun run --filter @apps/client qa:export:web-dev',
  `bun --bun x serve -s apps/client/.qa-dist-dev -l ${port}`,
].join(' && ');

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests-native',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: exportAndServe,
    cwd: repoRoot,
    url: baseURL,
    reuseExistingServer: !isCi,
    // Generous: this command runs `prebuild` + a full `expo export --dev`
    // (several minutes) BEFORE `serve` answers on `url`. The window must
    // cover the whole build, not just server boot.
    timeout: 900_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
