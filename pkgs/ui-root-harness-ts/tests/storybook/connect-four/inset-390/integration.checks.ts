import { expect, test } from '@playwright/test';
import { captureBoard, openBoard } from '../capture';
import { boardContext } from '../matrix';

test.use(boardContext(390));

// regression: connect-four-390-inset-narrowed
// At 390px the page lost its edge to a narrow inset that bought the board
// nothing. A phone's game is now one fixed view: the board takes the frame's
// whole width, never a gutter's worth short of it, so reaching into the page
// edge always buys the board room. The words around it keep the stage's one
// gutter: the meta line over the board (the game, then its facts) is centred
// within the same inset as the commands under it, and none of it is cut off.
test('storybook integration: connect-four 390px gives the board the whole width and keeps one page edge', async ({
  page,
}, info) => {
  await openBoard(page, 'drop-a-disc', 'light');
  const edges = await page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? { left: box.left, right: box.right } : null;
    };
    const board = rect('[data-testid="custom-game-board"]');
    const commands = rect(
      '[data-game-slot="controls"] [data-component="GameActionBar"]'
    );
    const heading = document.querySelector('[data-component="GameHeading"]');
    if (!heading) return { board, commands, meta: null };
    const style = getComputedStyle(heading);
    const box = heading.getBoundingClientRect();
    const parts = [
      ...heading.querySelectorAll(
        '[data-component="GameHeadingTitle"] h1, [data-component="GameHeadingTitle"] h2, [data-component="GameFact"]'
      ),
    ];
    const clipped = parts
      .filter((part) => part.scrollWidth > part.clientWidth + 1)
      .map((part) => part.textContent);
    const rects = parts.map((part) => part.getBoundingClientRect());
    return {
      board,
      commands,
      meta: {
        words: parts.map((part) => part.textContent.trim()),
        gutter: {
          left: box.left + Number.parseFloat(style.paddingLeft),
          right: box.right - Number.parseFloat(style.paddingRight),
        },
        left: Math.min(...rects.map((part) => part.left)),
        right: Math.max(...rects.map((part) => part.right)),
        clipped,
        overflow: heading.scrollWidth - heading.clientWidth,
      },
    };
  });
  await info.attach('page-edges-390', {
    body: JSON.stringify(edges, null, 2),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'page-edges-390');
  expect(edges.board).toEqual({ left: 0, right: 390 });
  expect(edges.commands).not.toBeNull();
  expect(edges.meta).not.toBeNull();
  const { commands, meta } = edges;
  if (!commands || !meta) return;
  // The meta line names the game, then its facts, on one line.
  expect(meta.words[0]).toBe('Connect Four');
  expect(meta.words.length).toBeGreaterThan(1);
  // One gutter: the meta line's inset is the commands' inset.
  expect(meta.gutter.left).toBeGreaterThanOrEqual(12);
  expect(meta.gutter.left).toBe(commands.left);
  expect(meta.gutter.right).toBe(commands.right);
  // Centred within that gutter, so on the stage.
  expect(
    Math.abs(
      (meta.left + meta.right) / 2 - (commands.left + commands.right) / 2
    )
  ).toBeLessThanOrEqual(1);
  // Nothing cut off at 390px.
  expect(meta.left).toBeGreaterThanOrEqual(meta.gutter.left);
  expect(meta.right).toBeLessThanOrEqual(meta.gutter.right);
  expect(meta.clipped).toEqual([]);
  expect(meta.overflow).toBeLessThanOrEqual(0);
});
