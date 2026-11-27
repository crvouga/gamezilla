import { expect, type Page, test } from '@playwright/test';
import { center, input } from '../quoridor-gestures/native';
import { expectQuoridorStoryPasses } from '../quoridor-overhaul/evidence';

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});

async function playFromBoard(page: Page, phone: boolean): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expectQuoridorStoryPasses(
    page,
    'screens-games-quoridor-classic--direct-manipulation',
    'light',
    'system'
  );
  const board = page.getByTestId('custom-game-board');
  const cell = (id: string) => board.locator(`[data-cell="${id}"]`);
  const touch = await input(page, phone);
  const tap = (p: { x: number; y: number }) =>
    phone ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y);
  const d4 = await center(cell('d4'));
  const e5 = await center(cell('e5'));
  const step = e5.x - d4.x;
  const horizontal = { x: d4.x + step / 4, y: (d4.y + e5.y) / 2 };
  const vertical = { x: (d4.x + e5.x) / 2, y: d4.y - step / 4 };
  await tap(horizontal);
  await expect(cell('d4')).toHaveAttribute('data-preview-edge-top', 'true');
  expect(await center(cell('d4'))).toEqual(d4);
  expect(await center(cell('e5'))).toEqual(e5);
  await tap(horizontal);
  await expect(cell('d4')).toHaveAttribute('data-edge-top', 'true');
  await tap(vertical);
  await expect(
    page.getByTestId('custom-game-board-wall-commit')
  ).toBeDisabled();
  await touch.drag(vertical, { ...vertical, x: vertical.x + step * 2 });
  await page.getByTestId('custom-game-board-wall-commit').click();
  await expect(cell('f4')).toHaveAttribute('data-edge-right', 'true');
  await touch.drag(await center(cell('e1')), await center(cell('e4')));
  await expect(cell('e1')).toHaveAttribute('data-identity', 'one');
  await touch.drag(await center(cell('e1')), await center(cell('e2')));
  const pawn = cell('e2').locator('span').first();
  await expect(pawn).toHaveCSS('animation-name', 'quoridor-travel');
  expect(
    await cell('e2').evaluate((el) =>
      parseFloat(el.style.getPropertyValue('--travel-y'))
    )
  ).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await cell('e8').press('Enter');
  await expect(cell('e8')).toHaveAttribute('data-identity', 'two');
  await expect(cell('e8').locator('span').first()).toHaveCSS(
    'animation-name',
    'none'
  );
}

// regression: quoridor-touch-confirmation-moves-gap
test('storybook integration: Quoridor gaps place both walls and a pawn travels from its previous square by touch', async ({
  page,
}) => {
  await playFromBoard(page, true);
});

test.describe('mouse', () => {
  test.use({ viewport: { width: 1440, height: 1024 }, hasTouch: false });
  test('storybook integration: Quoridor gaps place both walls and a pawn travels from its previous square', async ({
    page,
  }) => {
    await playFromBoard(page, false);
  });
});
