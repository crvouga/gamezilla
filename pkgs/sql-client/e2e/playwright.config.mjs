import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const PORT = 4177;
const e2eDir = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(e2eDir, '..');

export default defineConfig({
  testDir: join(e2eDir, 'tests'),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
  },
  webServer: {
    command: 'bun ./e2e/serve-harness.ts',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    cwd: pkgRoot,
  },
});
