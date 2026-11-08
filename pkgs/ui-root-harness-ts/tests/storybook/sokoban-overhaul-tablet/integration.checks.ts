import { test } from '@playwright/test';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 768, height: 1024 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

test('storybook integration: Sokoban overhaul solve and recover 768/light', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'light');
});

test('storybook integration: Sokoban overhaul solve and recover 768/dark', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'dark');
});
