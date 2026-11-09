import { test } from '@playwright/test';
import { openBoard } from '../capture';
import { boardContext } from '../matrix';
import { verifyRecordingCanvas } from '../recording';

test.use(boardContext(1440));

// regression: connect-four-recording-canvas-mismatched-viewport
test('storybook integration: connect-four desktop recording keeps its 1440 by 1024 canvas', async ({
  browser,
  page,
}, info) => {
  await openBoard(page, 'drop-a-disc', 'light');
  await verifyRecordingCanvas(browser, page, info);
});
