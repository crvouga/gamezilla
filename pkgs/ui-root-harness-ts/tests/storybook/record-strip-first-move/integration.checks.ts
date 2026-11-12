import { expect, type Page, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on' });

/** Where the board starts, and the moves' line over it. */
async function boardGeometry(page: Page, story: string) {
  await page.goto(
    `/iframe.html?id=screens-games-battleship-board--${story}&viewMode=story&globals=theme:light`
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await expect(page.getByTestId('custom-game-record')).toBeVisible();
  return page.evaluate(() => {
    const box = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const board = box('[data-testid="custom-game-board"]');
    const stage = box('[data-component="GameBoardStage"]');
    const record = box('[data-testid="custom-game-record"]');
    return {
      boardTop: (board?.top ?? Number.NaN) + window.scrollY,
      recordHeight: record?.height ?? Number.NaN,
      recordBeforeStage:
        stage !== null && record !== null && record.bottom <= stage.top,
    };
  });
}

// regression: phone-strip-first-move-reflow
// The record card above a phone's board rearranged itself when the first
// move landed, and the board dropped. A phone's game is one fixed view with
// the moves as one line over the stage: that line keeps its height from no
// moves to the first moves, so the board under it never moves.
test('storybook integration: the phone board stays where it is from no moves to the first moves', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Opening has no moves ("No moves yet."); Your turn has recorded volleys.
  const empty = await boardGeometry(page, 'opening');
  await expect(page.getByTestId('custom-game-record')).toContainText(
    'No moves yet.'
  );
  const played = await boardGeometry(page, 'your-turn');
  await expect(page.getByTestId('custom-game-record')).not.toContainText(
    'No moves yet.'
  );
  expect([empty.recordBeforeStage, played.recordBeforeStage]).toEqual([
    true,
    true,
  ]);
  expect(
    Math.abs(played.recordHeight - empty.recordHeight)
  ).toBeLessThanOrEqual(1);
  expect(Math.abs(played.boardTop - empty.boardTop)).toBeLessThanOrEqual(1);
});
