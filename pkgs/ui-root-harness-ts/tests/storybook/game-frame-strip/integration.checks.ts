import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on', hasTouch: true });

/** The moves' right edge and the expand chevron's left edge in the strip. */
async function stripEdges(page: Page) {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(
    '/iframe.html?id=screens-games-frame--move-waiting&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const strip = document.querySelector(
      '[data-testid="custom-game-move-strip"]'
    );
    const head = document.querySelector(
      '[data-testid="custom-game-move-strip-head"]'
    );
    const chevron = head?.lastElementChild;
    if (!strip || !chevron) throw new Error('Missing strip or chevron');
    const moves = [strip, ...strip.querySelectorAll('*')].map(
      (node) => node.getBoundingClientRect().right
    );
    return {
      movesRight: Math.max(...moves),
      chevronLeft: chevron.getBoundingClientRect().left,
    };
  });
}

// regression: game-frame-move-strip-under-chevron
test('storybook integration: game frame 320 move strip keeps the last move clear of the chevron', async ({
  page,
}) => {
  const edges = await stripEdges(page);
  expect(edges.movesRight).toBeLessThanOrEqual(edges.chevronLeft);
});
