import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const e2eDir = dirname(fileURLToPath(import.meta.url));
const pkgRoot = e2eDir;

const WEB_PORT = Number(process.env['PREVIEW_PORT'] ?? 5173);
const API_PORT = Number(process.env['SIM_HTTP_PORT'] ?? 8787);

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default defineConfig({
  testDir: join(e2eDir, 'tests'),
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testIgnore: ['**/auth-oauth-port.test.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  globalSetup: join(pkgRoot, 'playwright.global-setup.mjs'),
  setupFiles: [join(pkgRoot, 'playwright.setup.ts')],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    headless: true,
  },
  webServer: {
    command: 'bun ./e2e/serve-max-web.ts',
    port: WEB_PORT,
    reuseExistingServer: !process.env.CI,
    cwd: pkgRoot,
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
      PREVIEW_PORT: String(WEB_PORT),
      SIM_HTTP_PORT: String(API_PORT),
    },
  },
});
