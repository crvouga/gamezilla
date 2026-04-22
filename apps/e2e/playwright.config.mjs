import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

/** Remote cache only (no local .turbo); requires TURBO_* from Doppler. Same as root `bun preview`. */
const turboPreviewCmd = [
  'bun',
  'turbo',
  'run',
  '--cache=remote:rw',
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
