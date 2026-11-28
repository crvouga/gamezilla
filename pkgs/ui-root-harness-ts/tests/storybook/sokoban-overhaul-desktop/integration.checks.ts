import { test } from '@playwright/test';
import { timingTrace } from '../../../storybook/timing-trace';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 1440, height: 900 };
test.use({
  viewport,
  video: { mode: 'on', size: viewport },
  trace: timingTrace,
});

// regression: sokoban-recording-video-option-worker-scope
test('storybook integration: Sokoban overhaul solve and recover 1440', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport);
});
