import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on' });

// regression: compact-inset-narrow-applies-at-390
test('storybook integration: narrowest compact inset is 4px only below 360px', async ({
  page,
}, info) => {
  const measured: { width: number; theme: string; x: number | undefined }[] =
    [];
  for (const theme of ['light', 'dark']) {
    for (const [width, inset] of [
      [320, 4],
      [359, 4],
      [360, 16],
      [390, 16],
      [768, 16],
      [1440, 0],
    ] as const) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(
        `/iframe.html?id=templates-game-compact-inset--narrowest&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      const bounds = await page
        .getByTestId('precision-workspace')
        .boundingBox();
      measured.push({ width, theme, x: bounds?.x });
      expect(bounds?.x).toBe(inset);
      expect(bounds?.width).toBe(width - inset * 2);
      if (width === 320 || width === 390) {
        const path = info.outputPath(`narrowest-${width}-${theme}.png`);
        await page.screenshot({ path });
        await info.attach(`narrowest-${width}-${theme}`, {
          path,
          contentType: 'image/png',
        });
      }
    }
  }
  await info.attach('narrowest-insets', {
    body: JSON.stringify(measured, null, 2),
    contentType: 'application/json',
  });
});
