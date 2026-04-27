import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert } from '@gamezilla/lib/assert';

import { LOCAL_API_PREVIEW_ORIGIN } from '../constants/local-api-preview.mjs';

// ---------------------------------------------------------------------------
// Tiger style: validate every assumption up front so failures surface here,
// at the config-load boundary, rather than as a confused turbo task or a
// `[WebServer] exit 1` from a spawned child. Every assertion below has fired
// at least once in CI history; do not weaken without proof.
// ---------------------------------------------------------------------------

assert.nonEmptyString(
  LOCAL_API_PREVIEW_ORIGIN,
  'LOCAL_API_PREVIEW_ORIGIN must be a non-empty string'
);

let localApiPreviewUrl: URL | undefined;
assert.notThrows(
  () => {
    localApiPreviewUrl = new URL(LOCAL_API_PREVIEW_ORIGIN);
  },
  'LOCAL_API_PREVIEW_ORIGIN must parse as a URL',
  { value: LOCAL_API_PREVIEW_ORIGIN }
);
assert.defined(
  localApiPreviewUrl,
  'localApiPreviewUrl must be defined after URL parse'
);
assert.enum(
  localApiPreviewUrl.protocol,
  ['http:', 'https:'],
  'LOCAL_API_PREVIEW_ORIGIN must use http(s)'
);
assert.enum(
  localApiPreviewUrl.hostname,
  ['127.0.0.1', 'localhost', '0.0.0.0'],
  'LOCAL_API_PREVIEW_ORIGIN must point at loopback (the webServer below is local-only)'
);
assert.equals(
  localApiPreviewUrl.origin,
  LOCAL_API_PREVIEW_ORIGIN,
  'LOCAL_API_PREVIEW_ORIGIN must already be in canonical-origin form (no path/query/hash)'
);

// The Playwright webServer below boots a local API Worker via `turbo run
// preview`, so the client `setup-env.ts` step must resolve to that origin --
// not whatever EXPO_PUBLIC_API_URL Doppler may have injected (which is prod
// on shared configs and would trip the Tiger invariant in
// `assertTigerPolicyForResolvedApiOrigin('forbid-prod-on-this-machine')`).
//
// Force both vars unconditionally; an inherited prod URL is never correct
// here because the webServer is local-only.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// Remote cache only (no local .turbo); requires TURBO_* from Doppler
// (TURBO_CACHE=remote:rw forces remote). Same as root `bun preview`.
const turboPreviewCmd: string[] = [
  'bun',
  'turbo',
  'run',
  'preview',
  '--filter=@gamezilla/db',
  '--filter=@gamezilla/api',
  '--filter=@gamezilla/client',
];
assert.ok(
  turboPreviewCmd.length > 0,
  'turbo preview command must have at least one segment'
);
assert.all(
  turboPreviewCmd,
  (segment): asserts segment is string =>
    assert.nonEmptyString(segment, 'turbo command segment must be non-empty')
);

const baseURL = 'http://localhost:5173';
let baseURLParsed: URL | undefined;
assert.notThrows(
  () => {
    baseURLParsed = new URL(baseURL);
  },
  'baseURL must parse as URL',
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
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: turboPreviewCmd.join(' '),
    cwd: repoRoot,
    url: baseURL,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
});
