import { test } from '@playwright/test';
import { solveAndRecover } from '../sokoban-overhaul/solve-and-recover';

const viewport = { width: 320, height: 740 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

// regression: sokoban-narrow-feedback-moves-controls
test('storybook integration: Sokoban overhaul solve and recover 320/light', async ({
  page,
}, info) => {
  await solveAndRecover(page, info, viewport, 'light');
});
