import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCAL_API_PREVIEW_ORIGIN } from '../constants/local-api-preview.mjs';

// The Playwright webServer below boots a local API Worker on 8788, so the
// client `setup-env.ts` step must resolve to that origin -- not whatever
// EXPO_PUBLIC_API_URL Doppler may have injected (which is prod on shared
// configs and would trip the Tiger invariant in
// assertTigerPolicyForResolvedApiOrigin('forbid-prod-on-this-machine')).
//
// Force both vars unconditionally; an inherited prod URL is never correct
// here because the webServer is local-only.
process.env['API_URL'] = LOCAL_API_PREVIEW_ORIGIN;
process.env['EXPO_PUBLIC_API_URL'] = LOCAL_API_PREVIEW_ORIGIN;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..', '..', '..');

/** Remote cache only (no local .turbo); requires TURBO_* from Doppler
 * (TURBO_CACHE=remote:rw forces remote). Same as root `bun preview`. */
const turboPreviewCmd = [
  'bun',
  'turbo',
  'run',
  'preview',
  '--filter=@gamezilla/db',
  '--filter=@gamezilla/api',
  '--filter=@gamezilla/client',
].join(' ');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: turboPreviewCmd,
    cwd: repoRoot,
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
