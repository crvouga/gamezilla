import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { assert } from '@gamezilla/assert';

import { resolveLocalPreviewApiOriginSync } from '../constants/local-api-preview';

// Top-level `await` would turn this file into an async ES module, which
// Playwright's config loader (CommonJS `require()` via pirates) refuses to
// load. Use the sync resolver instead.
const LOCAL_API_PREVIEW_ORIGIN = resolveLocalPreviewApiOriginSync();

// ---------------------------------------------------------------------------
// Tiger style: validate every assumption up front so failures surface here,
// at the config-load boundary, rather than as a confused turbo task or a
// `[WebServer] exit 1` from a spawned child. Every assertion below has fired
// at least once in CI history; do not weaken without proof.
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

process.env['API_URL'] = LOCAL_API_PREVIEW_ORIGIN;
process.env['EXPO_PUBLIC_API_URL'] = LOCAL_API_PREVIEW_ORIGIN;

assert.equals(
  process.env['API_URL'],
  LOCAL_API_PREVIEW_ORIGIN,
  'API_URL must be set after override'
);
assert.equals(
  process.env['EXPO_PUBLIC_API_URL'],
  LOCAL_API_PREVIEW_ORIGIN,
  'EXPO_PUBLIC_API_URL must be set after override'
);

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

const repoRoot = path.join(__dirname, '..', '..', '..', '..');
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
  'turbo',
  'run',
  'preview',
  '--filter=@gamezilla/pg',
  '--filter=@gamezilla/api',
  '--filter=@gamezilla/client',
];
assert.ok(
  turboPreviewCmd.length > 0,
  'turbo preview command must have at least one segment'
);
assert.all(turboPreviewCmd, (segment): asserts segment is string =>
  assert.nonEmptyString(segment, 'turbo command segment must be non-empty')
);

const baseURL = 'http://localhost:5173';
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

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Playwright's default per-test timeout is 30s. Several individual
  // locator expectations in this directory pass `{ timeout: 60_000 }`
  // (e.g. the spaces-screen heading), which the default 30s test budget
  // makes literally unreachable — the test process is killed before the
  // 60s poll can complete. Set a per-test budget that exceeds every
  // locator timeout below by a comfortable margin so a single slow
  // dependency (cold isolate boot, Hyperdrive connect, large bundle
  // hydrate) doesn't cause a spurious 30s timeout that masks the real
  // failure mode.
  timeout: 120_000,
  expect: {
    // Default per-assertion poll budget. Individual assertions still
    // override; this just sets the floor above Playwright's 5s default
    // so a test that doesn't specify doesn't fail spuriously on a
    // cold-start request.
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: turboPreviewCmd.join(' '),
    cwd: repoRoot,
    url: baseURL,
    reuseExistingServer: !isCi,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
