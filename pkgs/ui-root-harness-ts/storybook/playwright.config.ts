// @io-wall-ok — resolve the repository's pinned screenshot renderer
import { spawnSync } from 'node:child_process';
import {
  CHROME_FOR_TESTING_TOOL,
  chromeForTestingBinary,
} from '@pkgs/ui-testing-bun-webview-server-ts/chrome-for-testing';
import { defineConfig } from '@playwright/test';
import { storybookTestNetwork } from './network';

const network = storybookTestNetwork(process.env);
const baseURL = `http://${network.host}:${network.port}`;

const chromeDirectory = spawnSync('mise', ['where', CHROME_FOR_TESTING_TOOL], {
  encoding: 'utf8',
});
if (chromeDirectory.status !== 0)
  throw new Error(
    'Install the pinned renderer with mise install http:chrome-for-testing'
  );
const executablePath = chromeForTestingBinary(chromeDirectory.stdout.trim());

export default defineConfig({
  testDir: '../tests/storybook',
  testMatch: [
    '**/stories.checks.ts',
    '**/gallery-round-eighteen.checks.ts',
    '**/board-round-four.checks.ts',
    '**/board-round-five.checks.ts',
    '**/board-round-eight.checks.ts',
    '**/word-tiles-round-five.checks.ts',
    '**/integration.checks.ts',
    '**/font-readiness.checks.ts',
    '**/essentials.checks.ts',
    '**/game-layout.checks.ts',
  ],
  outputDir: '../.cache/storybook-test-results',
  snapshotPathTemplate: '{testDir}/../../../../{arg}{ext}',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  // Authoring requires the explicit --update-snapshots command.
  updateSnapshots: 'none',
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', launchOptions: { executablePath } },
    },
  ],
  webServer: {
    command: 'bun static-server.ts',
    url: `${baseURL}/index.json`,
    reuseExistingServer: false,
  },
});
