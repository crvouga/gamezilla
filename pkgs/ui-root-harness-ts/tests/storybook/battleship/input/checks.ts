import { expect, type Page, test } from '@playwright/test';
import { captureBattleEvidence, openBattleStory } from '../evidence';

/**
 * A phone or tablet aims through the last region's enlarged cells; a wide
 * screen aims at the whole board. Returns the locator for a cell's aim.
 */
async function aimSurface(page: Page) {
  const workbench =
    (await page.getByTestId('custom-game-board-region').count()) > 0;
  if (workbench) await page.getByTestId('custom-game-board-area-9').tap();
  return (cell: string) =>
    page.getByTestId(
      workbench
        ? `custom-game-board-aim-${cell}`
        : `custom-game-board-target-${cell}`
    );
}

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
      let aim = (cell: string) => page.getByTestId(cell);
      await test.step('Aim with touch and correct J9 to J10', async () => {
        aim = await aimSurface(page);
        await aim('j9').tap();
        await aim('j10').tap();
        await expect(page.getByTestId('custom-game-board-fire')).toHaveText(
          'Fire at J10'
        );
      });
      await test.step('Cancel and select J10 with the keyboard', async () => {
        await page.getByTestId('custom-game-board-cancel-aim').click();
        await expect(page.getByTestId('custom-game-board-fire')).toBeDisabled();
        await aim('j9').focus();
        await page.keyboard.press('ArrowDown');
        await expect(aim('j10')).toBeFocused();
        // Evidence: the keyboard focus ring, distinct from selection.
        await info.attach('keyboard-focus', {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        });
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('custom-game-board-fire')).toHaveText(
          'Fire at J10'
        );
      });
      await test.step('Confirm once and retain the pending coordinate', async () => {
        await page.getByTestId('custom-game-board-fire').click();
        await expect(page.getByTestId('custom-game-board-fire')).toBeDisabled();
        await expect(aim('j10')).toHaveAccessibleName(
          'J10: fired, waiting for the result'
        );
        // regression: battleship-submitting-shot-loses-feedback
        // The idle title stays in the DOM beside the visible busy label.
        await expect(page.getByTestId('custom-game-board-fire')).toContainText(
          'Firing at J10'
        );
        await expect(page.getByText('Shots so far')).toHaveCount(0);
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
      // A watcher reads the whole board at every size: no aiming workbench.
      await expect(page.getByTestId('custom-game-board-region')).toHaveCount(0);
      await expect(page.getByText('Shots so far')).toBeVisible();
      await expect(
        page.getByTestId('custom-game-board-target-f10')
      ).toHaveAccessibleName('F10: hit, sunk Destroyer');
      await expect(page.getByTestId('custom-game-board-fire')).toHaveCount(0);
      await captureBattleEvidence(page, info);
      expect(errors).toEqual([]);
    });
  }
}
