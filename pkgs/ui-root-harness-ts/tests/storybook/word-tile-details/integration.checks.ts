import { expect, test } from '@playwright/test';

// regression: compact-word-tile-values-unavailable
for (const width of [390, 768, 1440])
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: word tile value readout is legible at ${width}/${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        `/iframe.html?id=screens-games-word-tiles-board--your-turn&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      const board = page.locator('[data-component="WordTileBoard"]');
      const details = board.locator('[data-testid$="-square-details"]');
      const occupied = board
        .getByRole('button', { name: /^C 3, .*committed$/ })
        .first();
      const label = await occupied.getAttribute('aria-label');
      if (label === null) throw new Error('Fixture has no committed C tile');
      const tile = await occupied.boundingBox();
      if (tile === null) throw new Error('Committed tile is missing');
      await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
      await expect(details).toHaveText(label);
      expect(
        await details.evaluate((node) =>
          Number.parseFloat(getComputedStyle(node).fontSize)
        )
      ).toBeGreaterThanOrEqual(12);
      const box = await details.boundingBox();
      if (box === null) throw new Error('Square detail readout is missing');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect(occupied).toHaveAttribute('aria-label', label);
    });
  }
