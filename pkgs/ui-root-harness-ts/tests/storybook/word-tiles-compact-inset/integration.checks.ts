import { expect, test } from '@playwright/test';

test.use({ video: 'on', trace: 'on' });
test.afterEach(async ({ page }, info) => {
  const path = info.outputPath('compact-inset.png');
  await page.screenshot({ path });
  await info.attach('compact-inset.png', { path, contentType: 'image/png' });
});

for (const width of [320, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const policy of ['standard', 'narrow']) {
      test(`storybook integration: word-tiles shared compact inset ${policy} ${width} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 740 });
        await page.goto(
          `/iframe.html?id=templates-game-compact-inset--${policy}&viewMode=story&globals=theme:${theme}`
        );
        await expect(page.locator('#storybook-root')).toHaveAttribute(
          'data-story-ready',
          'true'
        );
        const workspace = page.getByTestId('precision-workspace');
        const bounds = await workspace.boundingBox();
        expect(bounds).not.toBeNull();
        const inset = width < 1024 ? (policy === 'narrow' ? 4 : 16) : 0;
        expect(bounds?.x).toBe(inset);
        expect(bounds?.width).toBe(width - inset * 2);
        await expect(
          page.locator('[data-screen="precision-inset"]')
        ).toHaveCount(1);
        expect(
          await workspace.evaluate((element) => {
            let scrolling = 0;
            for (
              let parent = element.parentElement;
              parent;
              parent = parent.parentElement
            ) {
              if (getComputedStyle(parent).overflowY === 'auto') scrolling += 1;
            }
            return scrolling;
          })
        ).toBe(1);
      });
    }
  }
}
