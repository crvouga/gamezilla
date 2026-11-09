import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on', hasTouch: true });

// regression: record-empty-well-grows-on-first-move
test('storybook integration: the phone record keeps the board still on the first move', async ({
  page,
}, info) => {
  const measured: { width: number; story: string; top: number }[] = [];
  for (const width of [320, 390]) {
    for (const story of ['opening', 'drop-a-disc']) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(
        `/iframe.html?id=screens-games-connect-four-board--${story}&viewMode=story&globals=theme:light`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await expect(page.getByTestId('custom-game-record')).toBeVisible();
      const box = await page.getByTestId('custom-game-board').boundingBox();
      measured.push({ width, story, top: box?.y ?? -1 });
      const path = info.outputPath(`first-move-${story}-${String(width)}.png`);
      await page.screenshot({ path });
      await info.attach(`first-move-${story}-${String(width)}`, {
        path,
        contentType: 'image/png',
      });
    }
  }
  await info.attach('board-tops', {
    body: JSON.stringify(measured, null, 2),
    contentType: 'application/json',
  });
  // No moves yet (Opening) and moves played (Drop a disc): one board top.
  for (const width of [320, 390]) {
    const tops = measured.filter((m) => m.width === width).map((m) => m.top);
    expect(new Set(tops).size).toBe(1);
  }
});
