import { expect, type Page, test } from '@playwright/test';

test.use({ trace: 'on', hasTouch: true });

/** The play place at a 320px phone, while a move waits for the connection. */
async function openNarrowPlay(page: Page) {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(
    '/iframe.html?id=screens-games-custom-play--move-waiting&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  await page.evaluate(() => document.fonts.ready);
}

// regression: game-frame-move-strip-under-chevron
// A strip of moves pinned above a 320px board ran its last move under the
// strip's chevron. Nothing about the moves is pinned above the board any
// more: they are one card after it, every move inside the card.
test('storybook integration: game frame 320 keeps its moves in one card after the board, none clipped', async ({
  page,
}) => {
  await openNarrowPlay(page);
  await expect(
    page.locator('[data-component="GameSessionPinned"]')
  ).toHaveCount(0);
  const edges = await page.evaluate(() => {
    const record = document.querySelector('[data-testid="custom-game-record"]');
    const stage = document.querySelector('[data-component="GameBoardStage"]');
    if (!record || !stage) throw new Error('Missing the moves card or board');
    const card = record.getBoundingClientRect();
    const moves = [
      ...record.querySelectorAll('[data-testid^="custom-game-review-move-"]'),
    ].map((move) => move.getBoundingClientRect());
    return {
      cardTop: card.top,
      stageBottom: stage.getBoundingClientRect().bottom,
      cardLeft: card.left,
      cardRight: card.right,
      movesLeft: Math.min(...moves.map((move) => move.left)),
      movesRight: Math.max(...moves.map((move) => move.right)),
      count: moves.length,
    };
  });
  expect(edges.count).toBeGreaterThan(0);
  expect(edges.cardTop).toBeGreaterThanOrEqual(edges.stageBottom);
  expect(edges.movesLeft).toBeGreaterThanOrEqual(edges.cardLeft);
  expect(edges.movesRight).toBeLessThanOrEqual(edges.cardRight);
  expect(edges.cardRight).toBeLessThanOrEqual(320);
});
