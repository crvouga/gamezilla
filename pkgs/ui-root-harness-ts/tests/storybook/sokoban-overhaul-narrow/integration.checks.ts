import { test } from '@playwright/test';
import { timingTrace } from '../../../storybook/timing-trace';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 320, height: 740 };
test.use({
  viewport,
  video: { mode: 'on', size: viewport },
  trace: timingTrace,
});

// regression: sokoban-narrow-feedback-moves-controls
// regression: sokoban-solved-way-on-hidden
test('storybook integration: Sokoban overhaul solve and recover 320', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport);
});
