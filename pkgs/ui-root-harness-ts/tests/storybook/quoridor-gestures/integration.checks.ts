import { expect, test } from '@playwright/test';
import {
  expectQuoridorStoryPasses,
  observeQuoridorInput,
} from '../quoridor-overhaul/evidence';
import { gestureMetrics, observeDragFrames } from './metrics';
import { center, input } from './native';

// Recording options select the Playwright worker; both native viewports share its canvas.
test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'on',
});

for (const phone of [true, false]) {
  const viewport = phone
    ? { width: 390, height: 844 }
    : { width: 1440, height: 1024 };
  test.describe(phone ? 'phone Hill' : 'desktop Classic', () => {
    test.use({
      viewport,
      hasTouch: phone,
      contextOptions: { reducedMotion: 'no-preference' },
    });
    test('quoridor gestures: inspect, drag a wall preview, cancel and move a pawn', async ({
      page,
    }, info) => {
      await observeQuoridorInput(page);
      await observeDragFrames(page);
      await expectQuoridorStoryPasses(
        page,
        `screens-games-quoridor-${phone ? 'hill' : 'classic'}--direct-manipulation`,
        'light',
        'system'
      );
      await expect(page.locator('[data-reduced-motion="true"]')).toHaveCount(0);
      const board = page.getByTestId('custom-game-board');
      const box = await board.boundingBox();
      if (!box) throw new Error('Missing board');
      await info.attach('board-clip', {
        body: JSON.stringify(box),
        contentType: 'application/json',
      });
      const capture = async (name: string) =>
        info.attach(name, {
          body: await page.screenshot({ clip: box }),
          contentType: 'image/png',
        });
      const cell = (id: string) => board.locator(`[data-cell="${id}"]`);
      const driver = await input(page, phone);
      const anchor = await center(cell('e5'));
      const legal = await center(cell('e2'));
      if (phone) {
        await driver.touch('touchStart', [legal]);
        await driver.touch('touchStart', [legal, anchor]);
        await driver.touch('touchMove', [
          legal,
          { x: anchor.x, y: anchor.y - 65 },
        ]);
        await driver.touch('touchEnd', []);
      } else {
        await page.mouse.move(anchor.x, anchor.y);
        await page.keyboard.down('Control');
        await page.mouse.wheel(0, -160);
        await page.keyboard.up('Control');
      }
      await expect(
        page.getByRole('button', { name: 'Fit board' })
      ).toBeVisible();
      const fixed = phone ? legal : anchor;
      const projected = await center(cell(phone ? 'e2' : 'e5'));
      expect(
        Math.hypot(projected.x - fixed.x, projected.y - fixed.y)
      ).toBeLessThan(3);
      await capture('magnified');
      await driver.drag(anchor, { x: anchor.x + 55, y: anchor.y + 50 });
      await expect(cell('e1')).toHaveAttribute('data-identity', 'one');
      await page.getByTestId('custom-game-board-mode-h').click();
      if (phone) await cell('e5').tap();
      else await cell('e5').click();
      await expect(cell('e5')).toHaveAttribute('data-preview-edge-top', 'true');
      await expect(cell('e5')).toHaveAttribute('data-edge-top', 'false');
      await page.getByTestId('custom-game-board-wall-cancel').click();
      await page.getByRole('button', { name: 'Fit board' }).click();
      await expect(board).toHaveCSS('transform', 'none');
      await page.getByTestId('custom-game-board-mode-h').click();
      await driver.drag(
        await center(cell('c4')),
        await center(cell('d4')),
        async () => {
          await expect(cell('d4')).toHaveAttribute(
            'data-preview-edge-top',
            'true'
          );
          await capture('wall-under-pointer');
        }
      );
      await expect(
        page.getByTestId('custom-game-board-wall-commit')
      ).toBeEnabled();
      await expect(cell('d4')).toHaveAttribute('data-edge-top', 'false');
      await page.getByTestId('custom-game-board-wall-cancel').click();
      await page.getByTestId('custom-game-board-mode-move').click();
      const pawn = await center(cell('e1'));
      if (phone) {
        await driver.touch('touchStart', [pawn]);
        await driver.touch('touchMove', [legal]);
        await driver.touch('touchCancel', []);
        await expect(cell('e1')).toHaveAttribute('data-identity', 'one');
      }
      await driver.drag(pawn, legal, async () => {
        await expect(cell('e1')).toHaveAttribute('data-lifted', 'true');
        await capture('lifted-pawn');
      });
      await expect(cell('e2')).toHaveAttribute('data-identity', 'one');
      await expect(cell('e2').locator('span').first()).toHaveCSS(
        'animation-duration',
        '0.14s'
      );
      await capture('pawn-arrived');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(cell('e2').locator('span').first()).toHaveCSS(
        'animation-name',
        'none'
      );
      await info.attach('gesture-input-metrics', {
        body: JSON.stringify(await gestureMetrics(page)),
        contentType: 'application/json',
      });
    });
  });
}
