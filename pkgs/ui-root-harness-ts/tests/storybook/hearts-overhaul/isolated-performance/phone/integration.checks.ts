import { test } from '@playwright/test';
import { measureHeartsTrials } from '../trials';

test.use({
  viewport: { width: 390, height: 900 },
  hasTouch: true,
  trace: 'off',
  video: 'off',
});

// regression: hearts-isolated-trial-timeout
test('storybook integration: Hearts isolated latency 390 light: five complete touch trials', async ({
  page,
}, info) => {
  await measureHeartsTrials(page, info, 390, 'light');
});

test('storybook integration: Hearts isolated latency 390 dark: five complete touch trials', async ({
  page,
}, info) => {
  await measureHeartsTrials(page, info, 390, 'dark');
});
