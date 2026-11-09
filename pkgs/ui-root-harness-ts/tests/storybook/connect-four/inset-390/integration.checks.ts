import { expect, test } from '@playwright/test';
import { captureBoard, openBoard } from '../capture';
import { boardContext } from '../matrix';

test.use(boardContext(390));

// regression: connect-four-390-inset-narrowed
test('storybook integration: connect-four 390px keeps the standard page edge', async ({
  page,
}, info) => {
  await openBoard(page, 'drop-a-disc', 'light');
  const edges = await page.evaluate(() => {
    const board = document.querySelector('[data-testid="custom-game-board"]');
    const heading = document.querySelector(
      '#storybook-root h1, #storybook-root h2'
    );
    return {
      board: board?.getBoundingClientRect().left ?? -1,
      heading: heading?.getBoundingClientRect().left ?? null,
    };
  });
  await info.attach('page-edges-390', {
    body: JSON.stringify(edges, null, 2),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'page-edges-390');
  // The narrow board treatment is for widths below 360 px only.
  expect(edges.board).toBeGreaterThanOrEqual(16);
  if (edges.heading !== null) expect(edges.heading).toBeGreaterThanOrEqual(16);
});
