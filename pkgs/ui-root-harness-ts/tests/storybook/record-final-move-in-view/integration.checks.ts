import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on', viewport: { width: 1440, height: 844 } });

// regression: record-final-move-scrolled-out-of-view
test('storybook integration: a move table that shrinks after mount keeps its current move in view', async ({
  page,
}, info) => {
  await page.goto(
    '/iframe.html?id=games-shared-gamemovelist--states&viewMode=story&globals=theme:light'
  );
  await expect(page.locator('#storybook-root')).toHaveAttribute(
    'data-story-ready',
    'true'
  );
  // The table whose current move is its last, like a finished game.
  const table = page.locator('[data-layout="table"]', {
    has: page.locator('ol[aria-label="Latest moves"]'),
  });
  await expect(table).toBeVisible();
  const place = () =>
    table.evaluate((node) => {
      const buttons = [...node.querySelectorAll('button')];
      const marked = node.querySelector('[aria-current="step"]');
      if (!marked) return 'no current move';
      if (marked !== buttons.at(-1)) return 'current is not the last move';
      const box = node.getBoundingClientRect();
      const move = marked.getBoundingClientRect();
      return move.top >= box.top - 1 && move.bottom <= box.bottom + 1
        ? 'in view'
        : `out of view (${String(Math.round(move.bottom - box.bottom))}px below)`;
    });
  await expect.poll(place).toBe('in view');
  // The rail squeezes the table after mount (a height-capped board, fonts,
  // a status line above it): the current move must come back into view.
  await table.evaluate((node) => {
    (node as HTMLElement).style.maxHeight = '80px';
  });
  await expect.poll(place, { timeout: 3000 }).toBe('in view');
  await info.attach('table-after-shrink', {
    body: JSON.stringify(
      await table.evaluate((node) => ({
        height: node.getBoundingClientRect().height,
        scrollTop: node.scrollTop,
        scrollHeight: node.scrollHeight,
      })),
      null,
      2
    ),
    contentType: 'application/json',
  });
});
