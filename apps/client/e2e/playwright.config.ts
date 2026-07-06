import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { assert } from '@pkgs/assert';
import { resolveLocalPreviewApiOriginSync } from '@libs/integration-test/local-api-preview';
import {
  QA_DEV_IDP_PORT,
  QA_PREVIEW_BASE_URL,
  QA_PREVIEW_PORT,
} from '@libs/integration-test/qa-preview-ports';

import { applyPlaywrightPreviewEnv } from './playwright-preview-env';

// Top-level `await` would turn this file into an async ES module, which
// Playwright's config loader (CommonJS `require()` via pirates) refuses to
// load. Use the sync resolver instead.
const LOCAL_API_PREVIEW_ORIGIN = resolveLocalPreviewApiOriginSync();

// ---------------------------------------------------------------------------
// Tiger style: validate every assumption up front so failures surface here,
// at the config-load boundary, rather than as a confused turbo task or a
// `[WebServer] exit 1` from a spawned child. Every assertion below has fired
// at least once in CI history; do not weaken without proof.
//
// Vault-backed env (DATABASE_URL, etc.) is applied only when secrets are
// already injected — see `applyPlaywrightPreviewEnv` + globalSetup. The
// Playwright VS Code extension loads this file without `vault run`; crashing
// on missing DATABASE_URL breaks test discovery (`listFiles: test server
// connection closed`).
// ---------------------------------------------------------------------------

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
  'resolved local API preview origin must point at loopback (the webServer below is local-only)'
);
assert.equals(
  localApiPreviewUrl.origin,
  LOCAL_API_PREVIEW_ORIGIN,
  'resolved local API preview origin must already be in canonical-origin form (no path/query/hash)'
);

const baseURL = QA_PREVIEW_BASE_URL;
/** Readiness probe — must be served by `preview-server.ts`, not the Expo SPA fallback. */
const previewReadyURL = `${baseURL}/ready`;
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

const BUN_NODE_SHIM_PATTERN = /(?:^|\/)bun-node-[^/]+$/;
const rawPath = process.env['PATH'];
assert.nonEmptyString(rawPath, 'PATH must be defined for webServer spawn');
const cleanedPath = rawPath
  .split(':')
  .filter((segment) => !BUN_NODE_SHIM_PATTERN.test(segment))
  .join(':');
process.env['PATH'] = cleanedPath;
assert.nonEmptyString(
  process.env['PATH'],
  'PATH must remain non-empty after stripping bun-node shim'
);

assert.nonEmptyString(__dirname, '__dirname must resolve to a non-empty path');

const repoRoot = path.join(__dirname, '..', '..', '..');
assert.nonEmptyString(repoRoot, 'repoRoot must resolve to a non-empty path');
assert.ok(
  existsSync(path.join(repoRoot, 'turbo.json')),
  'repoRoot must contain turbo.json (sanity check that path traversal landed at the monorepo root)',
  { repoRoot, expected: path.join(repoRoot, 'turbo.json') }
);
assert.ok(
  existsSync(path.join(repoRoot, 'package.json')),
  'repoRoot must contain package.json',
  { repoRoot }
);

const turboPreviewCmd: string[] = [
  'bun',
  'run',
  '--filter',
  '@libs/integration-test',
  'kill-preview-ports',
  '&&',
  'bun',
  'turbo',
  'run',
  'preview',
  '--filter=@pkgs/dev-idp',
  '--filter=@apps/api',
  '--filter=@apps/client',
];
assert.ok(
  turboPreviewCmd.length > 0,
  'turbo preview command must have at least one segment'
);
assert.all(turboPreviewCmd, (segment): asserts segment is string =>
  assert.nonEmptyString(segment, 'turbo command segment must be non-empty')
);

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: repoRoot,
  testMatch: [
    'apps/client/e2e/tests/**/*.spec.ts',
    'libs/auth/src/e2e/**/*.spec.ts',
    'libs/chess/src/e2e/**/*.spec.ts',
  ],
  globalSetup: path.join(__dirname, 'playwright-global-setup.ts'),
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: turboPreviewCmd.join(' '),
    cwd: repoRoot,
    url: previewReadyURL,
    reuseExistingServer: !isCi,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PREVIEW_PORT: String(QA_PREVIEW_PORT),
      DEV_IDP_PORT: String(QA_DEV_IDP_PORT),
      EXPO_PUBLIC_API_URL: LOCAL_API_PREVIEW_ORIGIN,
      EXPO_PUBLIC_E2E: '1',
      API_URL: LOCAL_API_PREVIEW_ORIGIN,
    },
  },
});
