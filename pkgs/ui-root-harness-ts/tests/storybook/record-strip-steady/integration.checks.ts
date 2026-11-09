import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on', hasTouch: true });

// regression: record-strip-turn-height-changes
test('storybook integration: the phone record strip never moves the board between turns', async ({
  page,
}, info) => {
  const shifts: { width: number; tops: number[] }[] = [];
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(
      '/iframe.html?id=screens-games-connect-four-board--drop-a-disc&viewMode=story&globals=theme:light'
    );
    await expect(page.locator('#storybook-root')).toHaveAttribute(
      'data-story-ready',
      'true'
    );
    await expect(page.getByTestId('custom-game-record')).toBeVisible();
    const board = page.getByTestId('custom-game-board');
    const top = async () => (await board.boundingBox())?.y ?? -1;
    // The story's play leaves round 1 whole: two moves.
    const tops = [await top()];
    const column = page.getByTestId('custom-game-board-column-2');
    for (const [cell, disc] of [
      ['custom-game-board-cell-1', '1'],
      ['custom-game-board-cell-8', '2'],
    ] as const) {
      await column.click();
      await expect(page.getByTestId(cell)).toHaveAttribute('data-disc', disc);
      tops.push(await top());
    }
    shifts.push({ width, tops });
    const path = info.outputPath(`record-strip-${String(width)}.png`);
    await page.screenshot({ path });
    await info.attach(`record-strip-${String(width)}`, {
      path,
      contentType: 'image/png',
    });
  }
  await info.attach('board-tops', {
    body: JSON.stringify(shifts, null, 2),
    contentType: 'application/json',
  });
  // A whole round, a round of one move, a whole round again: one board top.
  for (const { tops } of shifts) expect(new Set(tops).size).toBe(1);
});
