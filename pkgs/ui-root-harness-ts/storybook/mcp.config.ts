import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../tests/storybook',
  testMatch: '**/mcp.checks.ts',
  retries: 0,
  outputDir: '../.cache/storybook-mcp-results',
  use: { baseURL: 'http://127.0.0.1:6008' },
  webServer: {
    command: 'bunx --no-install storybook dev -c . --ci --no-open -p 6008',
    url: 'http://127.0.0.1:6008/index.json',
    reuseExistingServer: false,
  },
});
