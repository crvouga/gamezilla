import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { assert } from '@pkgs/assert';

import {
  NATIVE_E2E_BASE_URL,
  assertNativeE2eStackRunningSync,
} from '../src/local-e2e-stack';
import {
  qaPlaywrightPaths,
  resolveGamezillaRepoRoot,
} from '../src/qa-playwright-paths';

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

const repoRoot = resolveGamezillaRepoRoot(__dirname);
assert.ok(
  existsSync(path.join(repoRoot, 'turbo.json')),
  'repoRoot must contain turbo.json',
  { repoRoot }
);

assertNativeE2eStackRunningSync(NATIVE_E2E_BASE_URL);

process.stdout.write(`[e2e:native] baseURL=${NATIVE_E2E_BASE_URL}\n`);

const qaPaths = qaPlaywrightPaths(repoRoot);
const nativeSpecsDir = path.join(__dirname, '..', 'e2e', 'specs', 'native');

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: nativeSpecsDir,
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  outputDir: qaPaths.resultsDir,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: qaPaths.reportDir }],
  ],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: NATIVE_E2E_BASE_URL,
    trace: 'on-first-retry',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
