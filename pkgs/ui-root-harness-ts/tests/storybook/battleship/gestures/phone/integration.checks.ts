import { test } from '@playwright/test';
import { verifyDrag, verifyInspection } from '../checks';

const viewport = { width: 390, height: 844 };
test.use({
  viewport,
  hasTouch: true,
  contextOptions: { reducedMotion: 'no-preference' },
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

// regression: battleship-touch-hover-shifts-board
// regression: battleship-drag-mounted-document
test('Battleship board gestures: drag the Carrier from C1 to C2 and cancel interrupted placement', async ({
  page,
}, info) => {
  await verifyDrag(page, info, viewport.width);
});
test('Battleship board gestures: pinch, pan, aim and fit', async ({
  page,
}, info) => {
  await verifyInspection(page, info, viewport.width);
});
