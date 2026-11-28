// @io-wall-ok — resolve the repository's pinned renderer
import { spawnSync } from 'node:child_process';
import {
  CHROME_FOR_TESTING_TOOL,
  chromeForTestingBinary,
} from '@pkgs/ui-testing-bun-webview-server-ts/chrome-for-testing';
import { defineConfig } from '@playwright/test';
import { storybookTestNetwork } from './network';
import { storybookShard } from './shard';

const network = storybookTestNetwork(process.env);
const shard = process.env['STORYBOOK_SHARD'];
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
    ...(process.env['STORYBOOK_PATTERN'] === 'space-evidence'
      ? ['**/space-evidence/capture.checks.ts']
      : []),
    ...(['screen-art-review', 'game-art-review'].includes(
      process.env['STORYBOOK_PATTERN'] ?? ''
    )
      ? ['**/screen-art-review/capture.checks.ts']
      : []),
    ...(process.env['STORYBOOK_PATTERN'] === 'mascot-review'
      ? ['**/screen-art-review/mascot.checks.ts']
      : []),
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
  ...(shard ? { shard: storybookShard(shard) } : {}),
  fullyParallel: true,
  workers: 2,
  retries: 0,
  // Nothing is compared against a committed picture. A run started by hand
  // with --update-snapshots is a diagnostic one, which logs its media.
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
