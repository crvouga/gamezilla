import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    // regression: publication-denial-state-clipped
    test(`storybook integration: publish denial and its step state fit at ${width}/${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(
        `/iframe.html?id=screens-puzzles-content-author--publish-denied&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await page.evaluate(() => document.fonts.ready);
      const track = page.getByTestId('content-publication-steps');
      const step = track
        .getByRole('listitem')
        .filter({ hasText: 'Publishing needs a verified account' });
      await expect(step).toHaveCount(1);
      await expect(step).toContainText('Locked');
      await expect(step.getByTestId('permission-denial')).toBeVisible();
      const failures = await step.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const failures: string[] = [];
        for (
          let node = walker.nextNode();
          node !== null;
          node = walker.nextNode()
        ) {
          if (
            !node.textContent?.trim() ||
            !node.parentElement?.checkVisibility()
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          const fits = Array.from(range.getClientRects()).every(
            (text) =>
              text.left >= rect.left &&
              text.right <= rect.right &&
              text.left >= 0 &&
              text.right <= window.innerWidth
          );
          if (!fits) failures.push(node.textContent);
        }
        return failures;
      });
      expect(failures).toEqual([]);
      // The supplied denial has no unlock action; do not invent a route.
      await expect(step.getByRole('button')).toHaveCount(0);
    });
  }
}
