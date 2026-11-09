import { expect, test } from '@playwright/test';
import { captureBattleEvidence, openBattleStory } from '../evidence';

export function defineInputChecks() {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: battleship pending confirmation ${theme}`, async ({
      page,
    }, info) => {
      const errors = await openBattleStory(
        page,
        'screens-games-battleship-board--opening',
        theme
      );
      await test.step('Select the last region with touch and correct J9 to J10', async () => {
        await page.getByTestId('custom-game-board-area-9').tap();
        await page.getByTestId('custom-game-board-aim-j9').tap();
        await page.getByTestId('custom-game-board-aim-j10').tap();
        await expect(page.getByTestId('custom-game-board-fire')).toHaveText(
          'Fire at J10'
        );
      });
      await test.step('Cancel and select J10 with the keyboard', async () => {
        await page.getByTestId('custom-game-board-cancel-aim').click();
        await expect(page.getByTestId('custom-game-board-fire')).toBeDisabled();
        await page.getByTestId('custom-game-board-aim-j9').focus();
        await page.keyboard.press('ArrowDown');
        await expect(
          page.getByTestId('custom-game-board-aim-j10')
        ).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('custom-game-board-fire')).toHaveText(
          'Fire at J10'
        );
      });
      await test.step('Confirm once and retain the pending coordinate', async () => {
        await page.getByTestId('custom-game-board-fire').click();
        await expect(page.getByTestId('custom-game-board-fire')).toBeDisabled();
        await expect(
          page.getByTestId('custom-game-board-aim-j10')
        ).toHaveAccessibleName('J10: fired, waiting for the result');
        // regression: battleship-submitting-shot-loses-feedback
        // The idle title stays in the DOM beside the visible busy label.
        await expect(page.getByTestId('custom-game-board-fire')).toContainText(
          'Firing at J10'
        );
        await expect(
          page.getByTestId('custom-game-board-target-tools')
        ).not.toContainText('Inspect');
        await expect(page.getByTestId('custom-game-status')).toContainText(
          'Sending choice…'
        );
        await captureBattleEvidence(page, info);
      });
      expect(errors).toEqual([]);
    });
    test(`storybook integration: battleship passive inspection ${theme}`, async ({
      page,
    }, info) => {
      const errors = await openBattleStory(
        page,
        'screens-games-battleship-board--watching',
        theme
      );
      const switcher = page.getByTestId('custom-game-board-view-target');
      if (await switcher.isVisible()) await switcher.click();
      await page.getByTestId('custom-game-board-area-9').tap();
      await expect(
        page.getByTestId('custom-game-board-aim-f10')
      ).toHaveAccessibleName('F10: hit, sunk Destroyer');
      await expect(page.getByTestId('custom-game-board-fire')).toHaveCount(0);
      await captureBattleEvidence(page, info);
      expect(errors).toEqual([]);
    });
  }
}
