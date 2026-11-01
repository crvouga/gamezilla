// @io-wall-ok — discover this test host's non-loopback network address.
import { networkInterfaces } from 'node:os';
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const lanAddress =
  Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .find((entry) => !entry.internal && entry.family === 'IPv4')?.address ??
  '127.0.0.1';

export default defineConfig({
  ...base,
  testMatch: '**/remote.checks.ts',
  outputDir: '../.cache/storybook-remote-results',
  workers: 1,
  projects: [
    {
      name: 'lan-interface',
      use: {
        baseURL: `http://${lanAddress}:6010`,
        browserName: 'chromium',
        launchOptions: {
          ...base.projects?.[0]?.use?.launchOptions,
          args: ['--no-proxy-server'],
        },
      },
    },
    {
      name: 'lan-hostname',
      use: {
        baseURL: 'http://storybook.test:6010',
        browserName: 'chromium',
        launchOptions: {
          ...base.projects?.[0]?.use?.launchOptions,
          args: [
            '--host-resolver-rules=MAP storybook.test 127.0.0.1',
            '--no-proxy-server',
          ],
        },
      },
    },
    {
      name: 'forwarded-port',
      use: {
        baseURL: 'http://localhost:6011',
        browserName: 'chromium',
        launchOptions: { ...base.projects?.[0]?.use?.launchOptions },
      },
    },
  ],
  webServer: [
    {
      command: 'bun ../scripts/storybook-dev.ts',
      env: {
        STORYBOOK_HOST: '0.0.0.0',
        STORYBOOK_PORT: '6010',
        STORYBOOK_ALLOWED_HOSTS: 'storybook.test',
        STORYBOOK_ORIGIN: '',
      },
      url: 'http://127.0.0.1:6010/index.json',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'bun ../tests/storybook/forward-fixture.ts',
      url: 'http://127.0.0.1:6011/index.json',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
