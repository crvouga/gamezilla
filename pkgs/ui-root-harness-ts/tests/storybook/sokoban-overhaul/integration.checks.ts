import { test } from '@playwright/test';
import { timingTrace } from '../../../storybook/timing-trace';
import { solveAndRecover } from './solve-and-recover';

const viewport = { width: 390, height: 844 };
test.use({
  viewport,
  video: { mode: 'on', size: viewport },
  trace: timingTrace,
});

test('storybook integration: Sokoban overhaul solve and recover 390/light', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'light');
});

test('storybook integration: Sokoban overhaul solve and recover 390/dark', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'dark');
});
