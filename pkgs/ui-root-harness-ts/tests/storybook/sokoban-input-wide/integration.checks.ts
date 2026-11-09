import { expect, test } from '@playwright/test';
import { capture, counts, openSokoban } from '../sokoban-overhaul/evidence';

const viewport = { width: 1440, height: 900 };
test.use({
  hasTouch: true,
  viewport,
  video: { mode: 'on', size: viewport },
  trace: 'on',
});

// regression: sokoban-wide-touch-screen-hides-steering
test('storybook integration: Sokoban wide touch pad keeps full targets and sends one move per tap', async ({
  page,
}, info) => {
  await openSokoban(page, 'puzzle--fresh', 'dark');
  const right = page.getByRole('button', { name: 'Move right' });
  const box = await right.boundingBox();
  if (!box) throw new Error('Movement control is missing');
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await right.tap();
  await counts(page, 1, 1);
  await right.tap();
  await counts(page, 2, 2);
  await capture(page, info, 'wide-touch');
});
