import { test } from '@playwright/test';
import { timingTrace } from '../../../storybook/timing-trace';
import { solveAndRecover } from './solve-and-recover';

const viewport = { width: 390, height: 844 };
test.use({
  viewport,
  video: { mode: 'on', size: viewport },
  trace: timingTrace,
});

// regression: sokoban-push-undo-timing-queries-input-targets
test('storybook integration: Sokoban overhaul solve and recover 390', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport);
});
