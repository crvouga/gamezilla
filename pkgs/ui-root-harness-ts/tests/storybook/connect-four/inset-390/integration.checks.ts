import { expect, test } from '@playwright/test';
import { captureBoard, openBoard } from '../capture';
import { boardContext } from '../matrix';

test.use(boardContext(390));

// regression: connect-four-390-inset-narrowed
// At 390px the page lost its edge to a narrow inset that bought the board
// nothing. A phone's game is now one fixed view: the board takes the frame's
// whole width, never a gutter's worth short of it, so reaching into the page
// edge always buys the board room, and the words around it keep one edge.
test('storybook integration: connect-four 390px gives the board the whole width and keeps one page edge', async ({
  page,
}, info) => {
  await openBoard(page, 'drop-a-disc', 'light');
  const edges = await page.evaluate(() => {
    const left = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().left ?? null;
    const board = document
      .querySelector('[data-testid="custom-game-board"]')
      ?.getBoundingClientRect();
    return {
      board: board?.left ?? -1,
      boardRight: board?.right ?? -1,
      heading: left('#storybook-root h1, #storybook-root h2'),
      commands: left(
        '[data-game-slot="controls"] [data-component="GameActionBar"] > *'
      ),
    };
  });
  await info.attach('page-edges-390', {
    body: JSON.stringify(edges, null, 2),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'page-edges-390');
  expect(edges.board).toBe(0);
  expect(edges.boardRight).toBe(390);
  expect(edges.heading).not.toBeNull();
  expect(edges.commands).not.toBeNull();
  expect(edges.heading).toBeGreaterThanOrEqual(12);
  expect(edges.heading).toBe(edges.commands);
});
