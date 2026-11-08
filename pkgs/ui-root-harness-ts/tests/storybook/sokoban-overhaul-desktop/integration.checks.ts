import { test } from '@playwright/test';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 1440, height: 900 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

test('storybook integration: Sokoban overhaul solve and recover 1440/light', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'light');
});

// regression: sokoban-recording-video-option-worker-scope
test('storybook integration: Sokoban overhaul solve and recover 1440/dark', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'dark');
});
