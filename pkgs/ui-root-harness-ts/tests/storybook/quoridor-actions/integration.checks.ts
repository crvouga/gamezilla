import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    // regression: quoridor-forced-pass-buried
    test(`storybook integration: mandatory Hill pass remains readable at ${width} ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width,
        height: width === 390 ? 844 : width === 768 ? 1024 : 900,
      });
      await page.goto(
        `/iframe.html?id=screens-games-quoridor-hill--must-pass&viewMode=story&globals=theme:${theme}`
      );
      await expect(page.locator('#storybook-root')).toHaveAttribute(
        'data-story-ready',
        'true'
      );
      await page.evaluate(() => document.fonts.ready);
      const pass = page.getByRole('button', { name: /pass turn/i });
      await expect(pass).toBeEnabled();
      const geometry = await pass.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        const bar = button.closest('[data-component="GameActionBar"]');
        if (bar === null) throw new Error('Pass action has no command bar');
        const outer = bar.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        const text = range.getBoundingClientRect();
        return {
          first: bar.querySelector('button') === button,
          contained:
            bounds.left >= outer.left &&
            bounds.right <= outer.right &&
            bounds.top >= outer.top &&
            bounds.bottom <= outer.bottom,
          readable:
            text.left >= bounds.left &&
            text.right <= bounds.right &&
            text.top >= bounds.top &&
            text.bottom <= bounds.bottom,
          withinWidth: bounds.left >= 0 && bounds.right <= window.innerWidth,
          withinHeight: bounds.top >= 0 && bounds.bottom <= window.innerHeight,
        };
      });
      expect(geometry).toEqual({
        first: true,
        contained: true,
        readable: true,
        withinWidth: true,
        withinHeight: true,
      });
      for (const name of ['Move pawn', 'Horizontal wall', 'Vertical wall'])
        await expect(
          page.getByRole('button', { name, exact: true })
        ).toBeDisabled();
      await expect(
        page.getByText('No pawn move or wall is legal. Pass your turn.', {
          exact: true,
        })
      ).toBeVisible();
    });
  }
}
