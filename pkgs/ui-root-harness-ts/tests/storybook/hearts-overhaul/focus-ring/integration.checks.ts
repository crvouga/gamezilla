// @io-wall-ok — browser geometry check; the test runner owns the browser.
import { expect, type Locator, test } from '@playwright/test';
import { openHearts } from '../evidence';

/** A focus ring's reach outside its control: a 2px ring at a 2px offset. */
const RING = 4;

/** Pixels of the ring that a clipping ancestor cuts off, per side. */
async function clippedRing(control: Locator) {
  return await control.evaluate((el, ring) => {
    const box = el.getBoundingClientRect();
    const reach = {
      top: box.top - ring,
      bottom: box.bottom + ring,
      left: box.left - ring,
      right: box.right + ring,
    };
    const cut = { top: 0, bottom: 0, left: 0, right: 0 };
    for (let node = el.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX === 'visible' && style.overflowY === 'visible')
        continue;
      const clip = node.getBoundingClientRect();
      cut.top = Math.max(cut.top, clip.top - reach.top);
      cut.bottom = Math.max(cut.bottom, reach.bottom - clip.bottom);
      cut.left = Math.max(cut.left, clip.left - reach.left);
      cut.right = Math.max(cut.right, reach.right - clip.right);
    }
    return cut;
  }, RING);
}

const NONE = { top: 0, bottom: 0, left: 0, right: 0 };

// regression: hearts-focus-ring-clipped
test('storybook integration: Hearts players disclosure keeps its whole focus ring at 320x568', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openHearts(
    page,
    'screens-games-hearts-interaction--pass-and-play',
    'light'
  );
  const toggle = page.getByRole('button', { name: 'Players and scores' });
  await toggle.focus();
  await expect(toggle).toBeFocused();
  expect(await clippedRing(toggle)).toEqual(NONE);
});

test('storybook integration: Hearts pass button keeps its whole focus ring at 1440', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await openHearts(
    page,
    'screens-games-hearts-interaction--pass-and-play',
    'dark'
  );
  const cards = page
    .getByRole('toolbar', { name: 'Your hand' })
    .getByRole('button');
  for (const index of [0, 1, 2]) await cards.nth(index).click();
  const pass = page.getByTestId('custom-game-board-pass');
  await pass.focus();
  await expect(pass).toBeFocused();
  expect(await clippedRing(pass)).toEqual(NONE);
});
