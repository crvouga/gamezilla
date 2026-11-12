import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on', hasTouch: true });

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story&globals=theme:light`);
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

async function boardWidth(page: Page, id: string): Promise<number> {
  await openStory(page, id);
  const board = await page
    .locator('[data-component="ChessBoard"]')
    .boundingBox();
  if (!board) throw new Error(`Missing board in ${id}`);
  return board.width;
}

// regression: game-frame-actions-below-tablet-fold
test('storybook integration: game frame fit 768x900 keeps Offer draw and Resign in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openStory(page, 'screens-games-chess-board--your-turn');
  // During play Offer draw and Resign wait behind Game menu, the play
  // screen's one way to the game's commands: it is in the first view, and
  // so are both commands once it is pressed.
  const inView = async (name: RegExp) => {
    const action = await page.getByRole('button', { name }).boundingBox();
    if (!action) throw new Error(`Missing ${String(name)}`);
    expect(action.y + action.height).toBeLessThanOrEqual(900);
  };
  await inView(/^Game menu/);
  await page.getByRole('button', { name: /^Game menu/ }).click();
  for (const name of [/^Offer a draw/, /^Resign/]) await inView(name);
});

// regression: game-frame-finished-board-shrinks-under-result
test('storybook integration: game frame fit 1440x900 keeps a finished board at its live size', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const live = await boardWidth(page, 'screens-games-chess-board--your-turn');
  const finished = await boardWidth(
    page,
    'screens-games-chess-board--checkmated'
  );
  const layout = await page.evaluate(() => {
    const at = (selector: string) => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return {
        display: getComputedStyle(node).display,
        columns: getComputedStyle(node).gridTemplateColumns,
        box: [box.x, box.y, box.width, box.height].map(Math.round),
      };
    };
    const stage = document.querySelector<HTMLElement>(
      '[data-component="GameBoardStage"]'
    );
    return {
      session: at(
        '[data-component="GameColumn"] > :not([data-component="GameHeading"])'
      ),
      outcome: at('[data-component="GameSessionOutcome"]'),
      layout: at('[data-component="GameLayout"]'),
      stage: at('[data-component="GameBoardStage"]'),
      fit: stage?.style.getPropertyValue('--game-board-fit') ?? null,
      stageClass: stage?.className ?? null,
    };
  });
  expect(finished, JSON.stringify(layout)).toBeGreaterThanOrEqual(live - 2);
  const board = await page
    .locator('[data-component="ChessBoard"]')
    .boundingBox();
  const rematch = await page
    .getByRole('button', { name: /^Rematch/ })
    .boundingBox();
  if (!board || !rematch) throw new Error('Missing board or Rematch');
  expect(rematch.x).toBeGreaterThanOrEqual(board.x + board.width);
  expect(rematch.y + rematch.height).toBeLessThanOrEqual(900);
});
