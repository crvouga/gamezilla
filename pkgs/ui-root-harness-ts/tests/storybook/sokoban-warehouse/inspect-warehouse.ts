import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { counts, openSokoban } from '../sokoban-overhaul/evidence';

import { measurePan } from './pan-timing';

async function frame(board: Locator) {
  const box = await board.boundingBox();
  if (!box) throw new Error('Playable board has no bounds');
  return box;
}

async function photograph(board: Locator, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await board.screenshot({ path, animations: 'disabled' });
  await info.attach(name, { path, contentType: 'image/png' });
}

async function playToDelivery(page: Page, board: Locator, info: TestInfo) {
  await board.press('ArrowRight');
  await board.press('ArrowRight');
  await counts(page, 2, 2);
  const filled = board.locator('[data-tone="settled"]');
  await expect(filled).toHaveCount(1);
  await photograph(board, info, 'delivered');
  await board.press('ArrowRight');
  await counts(page, 3, 3);
  await expect(filled).toHaveCount(0);
  await expect(board.getByRole('img', { name: /E4:.*worker/i })).toBeVisible();
  await photograph(board, info, 'worker-on-bay');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await counts(page, 2, 2);
  await expect(filled).toHaveCount(1);
}

async function pinch(page: Page, board: Locator, info: TestInfo) {
  const box = await frame(board);
  const finger = (id: number, x: number) => ({
    id,
    x: box.x + x * box.width,
    y: box.y + box.height / 2,
  });
  const touch = await page.context().newCDPSession(page);
  try {
    const send = (
      type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
      touchPoints: ReturnType<typeof finger>[]
    ) => touch.send('Input.dispatchTouchEvent', { type, touchPoints });
    await send('touchStart', [finger(1, 0.35)]);
    await send('touchStart', [finger(1, 0.35), finger(2, 0.65)]);
    await send('touchMove', [finger(1, 0.2), finger(2, 0.8)]);
    await send('touchEnd', []);
    await expect(board).toHaveAttribute('data-magnified', 'true');
    const layer = board.locator('[data-board-layer="terrain"]');
    const enlarged = await frame(layer);
    expect(enlarged.width / box.width).toBeCloseTo(2, 1);
    expect(
      Math.abs(enlarged.x + enlarged.width / 2 - box.x - box.width / 2)
    ).toBeLessThan(3);
    await photograph(board, info, 'pinched');
    await send('touchStart', [finger(1, 0.5)]);
    await measurePan(board, info, 'pointermove', (index) =>
      send('touchMove', [finger(1, index % 2 === 0 ? 0.55 : 0.45)])
    );
    await send('touchEnd', []);

    await send('touchStart', [finger(1, 0.3)]);
    await send('touchMove', [finger(1, 0.75)]);
    await send('touchCancel', []);
    await counts(page, 0, 0);
    await photograph(board, info, 'panned');
    await board.getByRole('button', { name: 'Fit board' }).click();
    await expect(board).toBeFocused();
    await send('touchStart', [finger(1, 0.25)]);
    await send('touchMove', [finger(1, 0.65)]);
    await send('touchEnd', []);
    await counts(page, 1, 1);
  } finally {
    await touch.detach();
  }
}

async function trackpad(page: Page, board: Locator, info: TestInfo) {
  const box = await frame(board);
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.keyboard.down('Control');
  try {
    await page.mouse.wheel(0, -170);
  } finally {
    await page.keyboard.up('Control');
  }
  await expect(board).toHaveAttribute('data-magnified', 'true');
  await photograph(board, info, 'trackpad-zoom');
  await measurePan(board, info, 'wheel', (index) =>
    page.mouse.wheel(index % 2 === 0 ? 8 : -8, 0)
  );

  await page.mouse.wheel(-2000, -2000);
  const layer = board.locator('[data-board-layer="terrain"]');
  await expect
    .poll(async () => Math.abs((await frame(layer)).x - box.x))
    .toBeLessThan(1);
  await counts(page, 0, 0);
  await photograph(board, info, 'trackpad-pan');
  await board.press('Shift+ArrowDown');
  await counts(page, 0, 0);
  await board.press('Escape');
  await expect(board).toHaveAttribute('data-magnified', 'false');
  await board.press('+');
  const crate = board.getByRole('img', { name: /C4:.*crate/i });
  await crate.click();
  await counts(page, 1, 1);
  await board.press('0');
}

export async function inspectWarehouse(
  page: Page,
  info: TestInfo,
  input: 'touch' | 'trackpad'
) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openSokoban(page, 'puzzle--fresh', 'light');
  const board = page.getByTestId('sokoban-board');
  if (input === 'touch') await pinch(page, board, info);
  else await trackpad(page, board, info);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await counts(page, 0, 0);
  const crate = board.locator('[data-tone="object"]').first();
  await expect(crate).toHaveCSS('transition-duration', '0.12s');
  await playToDelivery(page, board, info);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(crate).toHaveCSS('transition-duration', '0s');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await counts(page, 1, 1);
  await expect(board.locator('[data-tone="settled"]')).toHaveCount(0);
}
