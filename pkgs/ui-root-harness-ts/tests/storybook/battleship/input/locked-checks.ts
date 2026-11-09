import { expect, test } from '@playwright/test';
import { captureBattleEvidence, openBattleStory } from '../evidence';

export function defineLockedInspectionChecks() {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: battleship locked fleet inspection ${theme}`, async ({
      page,
    }, info) => {
      await openBattleStory(
        page,
        'screens-games-battleship-setup--locked',
        theme
      );
      const grid = page.getByTestId('custom-game-setup-grid');
      const names = await grid
        .locator('[data-cell]')
        .evaluateAll((cells) =>
          cells.map((cell) => cell.getAttribute('aria-label'))
        );
      try {
        if (
          !(await page.getByTestId('custom-game-setup-precision').isVisible())
        ) {
          await expect(
            page.getByTestId('custom-game-setup-enlarge')
          ).toBeEnabled({ timeout: 2000 });
          await page.getByTestId('custom-game-setup-enlarge').click();
        }
        await test.step('Inspect the locked destroyer outside the initial quadrant', async () => {
          await expect(
            page.getByTestId('custom-game-setup-area-1')
          ).toBeEnabled({ timeout: 2000 });
          await page.getByTestId('custom-game-setup-area-1').tap();
          const cell = page.getByTestId('custom-game-setup-precision-cell-g4');
          await expect(cell).toHaveAccessibleName('G4: Destroyer');
          await cell.focus();
          await page.keyboard.press('r');
          await page.keyboard.press('Enter');
          await expect(cell).toHaveAccessibleName('G4: Destroyer');
        });
        await test.step('Switch full and enlarged views without changing any ship', async () => {
          await page.getByTestId('custom-game-setup-enlarge').click();
          await expect(
            page.getByTestId('custom-game-setup-precision')
          ).toHaveCount(0);
          await page.getByTestId('custom-game-setup-enlarge').click();
          await expect(
            page.getByTestId('custom-game-setup-precision-cell-g4')
          ).toHaveAccessibleName('G4: Destroyer');
          expect(
            await grid
              .locator('[data-cell]')
              .evaluateAll((cells) =>
                cells.map((cell) => cell.getAttribute('aria-label'))
              )
          ).toEqual(names);
        });
      } finally {
        await captureBattleEvidence(page, info);
      }
    });
  }
}
