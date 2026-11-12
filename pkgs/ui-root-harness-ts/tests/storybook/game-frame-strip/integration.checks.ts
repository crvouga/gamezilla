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
// strip's chevron. A phone's game is one fixed view with the moves as one
// line over the board, the latest in view: that move lies whole inside the
// line, nothing over it, and the line within the screen.
test('storybook integration: game frame 320 keeps its latest move whole on the line over the board', async ({
  page,
}) => {
  await openNarrowPlay(page);
  await expect(
    page.locator('[data-component="GameSessionPinned"]')
  ).toHaveCount(0);
  const edges = await page.evaluate(() => {
    const record = document.querySelector('[data-testid="custom-game-record"]');
    const stage = document.querySelector('[data-component="GameBoardStage"]');
    if (!record || !stage) throw new Error('Missing the moves line or board');
    const line = record.getBoundingClientRect();
    const moves = [
      ...record.querySelectorAll('[data-testid^="custom-game-review-move-"]'),
    ];
    const latest = moves.at(-1);
    if (!latest) throw new Error('Missing the latest move');
    const move = latest.getBoundingClientRect();
    // Whatever clips the moves (the line's scroller) bounds what is seen.
    let seen = line;
    for (
      let node = latest.parentElement;
      node && node !== record;
      node = node.parentElement
    )
      if (getComputedStyle(node).overflowX !== 'visible')
        seen = node.getBoundingClientRect();
    const covered = [
      [move.left + 2, move.top + 2],
      [move.right - 2, move.top + 2],
      [move.left + 2, move.bottom - 2],
      [move.right - 2, move.bottom - 2],
    ].some(([x, y]) => {
      const hit = document.elementFromPoint(x ?? 0, y ?? 0);
      return hit === null || !latest.contains(hit);
    });
    return {
      count: moves.length,
      lineBottom: line.bottom,
      lineRight: line.right,
      stageTop: stage.getBoundingClientRect().top,
      moveLeft: move.left,
      moveRight: move.right,
      seenLeft: seen.left,
      seenRight: seen.right,
      covered,
    };
  });
  expect(edges.count).toBeGreaterThan(0);
  expect(edges.lineBottom).toBeLessThanOrEqual(edges.stageTop);
  expect(edges.moveLeft).toBeGreaterThanOrEqual(edges.seenLeft);
  expect(edges.moveRight).toBeLessThanOrEqual(edges.seenRight);
  expect(edges.covered).toBe(false);
  expect(edges.lineRight).toBeLessThanOrEqual(320);
});
