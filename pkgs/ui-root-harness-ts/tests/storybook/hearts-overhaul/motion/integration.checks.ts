// @io-wall-ok — browser evidence adapter; the test runner owns the browser.
import { expect, test } from '@playwright/test';
import { openHearts } from '../evidence';

const STORY = 'screens-games-hearts-interaction--pass-and-play';

async function liftDuration(
  page: import('@playwright/test').Page
): Promise<string> {
  const card = page
    .getByRole('toolbar', { name: 'Your hand' })
    .getByRole('button')
    .first();
  return await card.evaluate((el) => getComputedStyle(el).transitionDuration);
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

// Storybook no longer forces reduced motion, so both settings are real here.
test('storybook integration: Hearts card lift animates, and stops for reduced motion', async ({
  page,
}) => {
  await openHearts(page, STORY, 'light', 'no-preference');
  expect((await liftDuration(page)).split(',').some((d) => d !== '0s')).toBe(
    true
  );
  await openHearts(page, STORY, 'light', 'reduce');
  expect(
    (await liftDuration(page)).split(/,\s*/).every((d) => d === '0s')
  ).toBe(true);
});
