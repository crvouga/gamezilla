// @io-wall-ok — native target stability regression with retained evidence.
import { expect, test } from '@playwright/test';
import {
  observeInput,
  openStory,
  recordEvidence,
} from '../word-tiles/evidence';

test.use({ video: 'on', trace: 'on' });
test.beforeEach(async ({ page }) => observeInput(page));
test.afterEach(async ({ page }, info) => recordEvidence(page, info));

// regression: word-tiles-focus-moves-pointer-target
test('storybook integration: word-tiles pointer press keeps the square beneath release', async ({
  page,
}) => {
  await openStory(page, 'opening', 'light');
  await page.getByTestId('custom-game-board-rack-11').click();
  const target = page.getByTestId('custom-game-board-cell-g8');
  const before = await target.boundingBox();
  if (!before) throw new Error('Visible placement target is missing');
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2
  );
  await page.mouse.down();
  await expect(target).toBeFocused();
  const pressed = await target.boundingBox();
  await page.mouse.up();
  expect(pressed).toEqual(before);
  await expect(target).toHaveAttribute('data-state', 'tentative');
});
