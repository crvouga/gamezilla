import { expect, test } from '@playwright/test';
import { openBattleStory } from '../evidence';
import { center, dragShip, snapshot, touch } from './input';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Battleship board gestures ${viewport.width}`, () => {
    test.use({
      viewport,
      hasTouch: true,
      trace: 'on',
      video: { mode: 'on', size: viewport },
    });
    test('pick up at midship, preview, place and cancel an interrupted drag', async ({
      page,
    }, info) => {
      await openBattleStory(
        page,
        'screens-games-battleship-setup--partial',
        'light'
      );
      const full = page.getByRole('button', { name: 'Show full board' });
      if (await full.isVisible()) await full.click();
      const grid = page.getByTestId('custom-game-setup-grid');
      await grid.scrollIntoViewIfNeeded();
      await dragShip(page, grid, viewport.width === 390, info);
      const input = await touch(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const from = await center(grid.locator('[data-cell="c2"]'));
      const to = await center(grid.locator('[data-cell="c4"]'));
      await input.send('touchStart', [from]);
      await input.send('touchMove', [to]);
      await expect(grid.locator('[data-cell="c4"] span').first()).toHaveCSS(
        'animation-name',
        'none'
      );
      await input.send('touchStart', [to, { x: to.x + 30, y: to.y }]);
      await input.send('touchCancel', []);
      await input.close();
      await expect(grid.locator('[data-cell="c2"]')).toHaveAccessibleName(
        'C2: Carrier'
      );
      await expect(grid.locator('[data-cell="c4"]')).toHaveAccessibleName(
        'C4: open water'
      );
    });
    test('pinch around the midpoint, pan, aim in transformed coordinates and fit', async ({
      page,
    }, info) => {
      await openBattleStory(
        page,
        'screens-games-battleship-board--opening',
        'light'
      );
      const phone = viewport.width === 390;
      const grid = page.getByTestId(
        phone ? 'custom-game-board-aim-grid' : 'custom-game-board-target-grid'
      );
      const view = grid.locator('xpath=../..');
      const mark = grid.locator(
        phone ? '[data-cell="c1"]' : '[data-cell="e5"]'
      );
      await grid.scrollIntoViewIfNeeded();
      const mid = await center(mark);
      const input = await touch(page);
      const pair = (r: number) => [
        { x: mid.x - r, y: mid.y },
        { x: mid.x + r, y: mid.y },
      ];
      await input.send('touchStart', pair(16));
      await input.send('touchMove', pair(26));
      await input.send('touchEnd', []);
      await input.close();
      await expect(view).not.toHaveAttribute('data-scale', '1');
      const after = await center(mark);
      expect(Math.abs(after.x - mid.x)).toBeLessThan(3);
      expect(Math.abs(after.y - mid.y)).toBeLessThan(3);
      await page.mouse.move(mid.x, mid.y);
      await page.mouse.down();
      await page.mouse.move(mid.x - 15, mid.y - 6, { steps: 4 });
      await page.mouse.up();
      await expect(page.getByTestId('custom-game-board-fire')).toBeDisabled();
      await mark.click();
      await expect(page.getByTestId('custom-game-board-fire')).toContainText(
        phone ? 'Fire at C1' : 'Fire at E5'
      );
      await snapshot(view, info, 'inspection');
      await page.getByRole('button', { name: 'Fit board' }).click();
      await expect(view).toHaveAttribute('data-scale', '1');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(mark.locator('span').first()).toHaveCSS(
        'animation-name',
        'none'
      );
      await expect(
        grid.locator('[data-tone="alert"],[data-tone="quiet"]')
      ).toHaveCount(0);
    });
  });
}
