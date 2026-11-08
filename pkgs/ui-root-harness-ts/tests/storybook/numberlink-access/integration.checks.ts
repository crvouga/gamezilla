import { expect, test } from '@playwright/test';
import {
  accessibility,
  attachJson,
  capture,
  openBoard,
  openStory,
} from '../numberlink-board/evidence';

const viewport = { width: 390, height: 844 };
test.use({ viewport, video: { mode: 'on', size: viewport }, trace: 'on' });

for (const theme of ['light', 'dark']) {
  test.describe(theme, () => {
    test(`storybook integration: numberlink-access natural Tab entry ${theme}`, async ({
      page,
    }, info) => {
      await openBoard(page, theme);
      const first = page.getByTestId('numberlink-board-cell-0');
      const visited: (string | null)[] = [];
      for (let step = 0; step < 20; step++) {
        await page.keyboard.press('Tab');
        visited.push(
          await page.evaluate(
            () =>
              document.activeElement?.getAttribute('data-testid') ??
              document.activeElement?.textContent ??
              null
          )
        );
        if (await first.evaluate((cell) => cell === document.activeElement))
          break;
      }
      await attachJson(info, 'tab-sequence', visited);
      await expect(first).toBeFocused();
      await capture(page, info, 'keyboard-focus');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowRight');
      await capture(page, info, 'keyboard-preview');
      await page.keyboard.press('Escape');
      await expect(
        page.getByTestId('numberlink-board-cell-1')
      ).toHaveAccessibleName('B1: empty');
      await capture(page, info, 'keyboard-cancelled');
      await accessibility(page, info);
    });

    for (const screen of ['puzzle', 'editor'])
      test(`storybook integration: numberlink-access unreadable ${screen} ${theme}`, async ({
        page,
      }, info) => {
        await openStory(
          page,
          theme,
          `screens-games-numberlink-${screen}--unreadable`
        );
        await capture(page, info, 'unreadable-next-action');
        await expect(page.getByTestId('numberlink-board')).toHaveCount(0);
        await expect(
          page.getByText(
            screen === 'puzzle'
              ? /This puzzle cannot be opened/
              : /This drawing cannot be opened/
          )
        ).toBeVisible();
        await accessibility(page, info);
      });

    test(`storybook integration: numberlink-access editor pointer and keyboard placement ${theme}`, async ({
      page,
    }, info) => {
      await openBoard(
        page,
        theme,
        'screens-games-numberlink-editor--edit-endpoints'
      );
      await capture(page, info, 'initial-selection');
      await page.getByTestId('numberlink-board-cell-1').click();
      await expect(
        page.getByTestId('numberlink-board-cell-1')
      ).toHaveAccessibleName('B1: endpoint 1, unfinished');
      await expect(
        page.getByTestId('numberlink-board-cell-0')
      ).toHaveAccessibleName('A1: empty');
      await capture(page, info, 'first-endpoint-moved');
      await page.getByTestId('numberlink-board-cell-12').focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByTestId('numberlink-board-cell-12')
      ).toHaveAccessibleName('C3: endpoint 1, unfinished');
      await expect(
        page.getByTestId('numberlink-board-cell-13')
      ).toHaveAccessibleName('D3: empty');
      await capture(page, info, 'second-endpoint-moved');
      await accessibility(page, info);
    });
  });
}
