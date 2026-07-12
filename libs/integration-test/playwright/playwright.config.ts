import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { assert } from '@pkgs/assert';

import { resolveLocalPreviewApiOriginSync } from '../src/local-api-preview';
import { requireLocalE2eStackSync } from '../src/local-e2e-stack';
import {
  qaPlaywrightPaths,
  resolveGamezillaRepoRoot,
} from '../src/qa-playwright-paths';

import { applyPlaywrightPreviewEnv } from './playwright-preview-env';

const LOCAL_API_PREVIEW_ORIGIN = resolveLocalPreviewApiOriginSync();

assert.nonEmptyString(
  LOCAL_API_PREVIEW_ORIGIN,
  'resolved local API preview origin must be a non-empty string'
);

let localApiPreviewUrl: URL | undefined;
assert.notThrows(
  () => {
    localApiPreviewUrl = new URL(LOCAL_API_PREVIEW_ORIGIN);
  },
  'resolved local API preview origin must parse as a URL',
  { value: LOCAL_API_PREVIEW_ORIGIN }
);
assert.defined(
  localApiPreviewUrl,
  'localApiPreviewUrl must be defined after URL parse'
);
assert.enum(
  localApiPreviewUrl.protocol,
  ['http:', 'https:'],
  'resolved local API preview origin must use http(s)'
);
assert.enum(
  localApiPreviewUrl.hostname,
  ['127.0.0.1', 'localhost', '0.0.0.0'],
  'resolved local API preview origin must point at loopback'
);
assert.equals(
  localApiPreviewUrl.origin,
  LOCAL_API_PREVIEW_ORIGIN,
  'resolved local API preview origin must already be in canonical-origin form (no path/query/hash)'
);

const e2eStack = requireLocalE2eStackSync(LOCAL_API_PREVIEW_ORIGIN);

const baseURL = e2eStack.baseURL;
const previewReadyURL = e2eStack.readyURL;
let baseURLParsed: URL | undefined;
assert.notThrows(
  () => {
    baseURLParsed = new URL(baseURL);
  },
  'baseURL must parse as a URL',
  { baseURL }
);
assert.defined(baseURLParsed, 'baseURLParsed must be defined after URL parse');
assert.enum(
  baseURLParsed.protocol,
  ['http:', 'https:'],
  'baseURL must use http(s)'
);

void applyPlaywrightPreviewEnv({
  baseURL,
  localApiPreviewOrigin: LOCAL_API_PREVIEW_ORIGIN,
});

process.stdout.write(`[e2e] baseURL=${baseURL} readyURL=${previewReadyURL}\n`);

assert.nonEmptyString(__dirname, '__dirname must resolve to a non-empty path');

const repoRoot = resolveGamezillaRepoRoot(__dirname);
assert.ok(
  existsSync(path.join(repoRoot, 'turbo.json')),
  'repoRoot must contain turbo.json',
  { repoRoot }
);
assert.ok(
  existsSync(path.join(repoRoot, 'package.json')),
  'repoRoot must contain package.json',
  { repoRoot }
);

const qaPaths = qaPlaywrightPaths(repoRoot);
const browserSpecsDir = path.join(__dirname, '..', 'e2e', 'specs', 'browser');

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: browserSpecsDir,
  testMatch: '**/*.spec.ts',
  globalSetup: path.join(__dirname, 'playwright-global-setup.ts'),
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
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }],
});
