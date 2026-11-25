// @io-wall-ok — the hosted Playwright runner owns the browser and its input devices.
import { expect, type Locator, type Page, test } from '@playwright/test';
import { openHearts } from '../evidence';
import { saveHeartsMetrics, startHeartsMetrics } from '../metrics';

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Missing Hearts interaction target');
  return box;
}

async function center(locator: Locator) {
  const box = await bounds(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return (
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: { x: number; y: number; id: number }[]
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
}

async function inspect(page: Page, phone: boolean) {
  const frame = page.locator('[data-hearts-viewport]');
  const c = await center(frame);
  if (phone) {
    const send = await touch(page);
    const contacts = (radius: number) =>
      [-1, 1].map((sign, id) => ({
        x: c.x + sign * radius,
        y: c.y,
        id: id + 1,
      }));
    await send('touchStart', contacts(20));
    await send('touchMove', contacts(40));
    await send('touchEnd', []);
  } else {
    await page.mouse.move(c.x, c.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -210);
    await page.keyboard.up('Control');
  }
  await expect(page.getByRole('button', { name: 'Fit table' })).toBeVisible();
  const felt = frame.locator('[data-table-felt]');
  const rect = await bounds(frame);
  const enlarged = await bounds(felt);
  expect(enlarged.width / rect.width).toBeCloseTo(2, 1);
  expect(Math.abs(enlarged.x + enlarged.width / 2 - c.x)).toBeLessThan(3);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + rect.width, c.y + rect.height, { steps: 6 });
  await page.mouse.up();
  const panned = await bounds(felt);
  expect(Math.abs(panned.x - rect.x)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Fit table' }).click();
  await expect(page.getByRole('button', { name: 'Zoom table' })).toBeVisible();
  expect((await bounds(felt)).width).toBeCloseTo(rect.width, 0);
}

async function drag(
  page: Page,
  card: Locator,
  phone: boolean,
  cancel: boolean
) {
  const start = await center(card);
  const end = await center(page.locator('[data-hearts-viewport]'));
  if (phone) {
    const send = await touch(page);
    const first = { ...start, id: 1 };
    await send('touchStart', [first]);
    await send('touchMove', [{ ...end, id: 1 }]);
    if (cancel) {
      await send('touchStart', [
        { ...end, id: 1 },
        { ...start, id: 2 },
      ]);
      await send('touchCancel', []);
    } else await send('touchEnd', []);
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
  }
}

for (const phone of [true, false]) {
  const viewport = phone
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 };
  test.describe(`Hearts gestures ${viewport.width}`, () => {
    test.use({
      viewport,
      hasTouch: phone,
      video: { mode: 'on', size: viewport },
      trace: 'on',
    });
    test('inspect the table, cancel pickup, pass and land a card', async ({
      page,
    }, info) => {
      await openHearts(
        page,
        'screens-games-hearts-interaction--pass-and-play',
        'light'
      );
      const board = page.getByTestId('custom-game-board');
      const rate = phone ? 4 : 1;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await startHeartsMetrics(page);
      const initial = await board.getAttribute('data-position');
      const cards = board.getByRole('toolbar').getByRole('button');
      await inspect(page, phone);
      await drag(page, cards.first(), phone, true);
      await expect(board.locator('[aria-pressed="true"]')).toHaveCount(0);
      await expect(board).toHaveAttribute('data-position', initial ?? '');
      for (const i of [0, 1, 2]) await drag(page, cards.nth(i), phone, false);
      await expect(board.locator('[aria-pressed="true"]')).toHaveCount(3);
      await board.screenshot({ path: info.outputPath('gesture-pass.png') });
      await page.getByTestId('custom-game-board-pass').click();
      const legal = cards.and(board.locator('[aria-disabled="false"]')).first();
      await drag(page, legal, phone, true);
      const card = await legal.getAttribute('data-card');
      await drag(page, legal, phone, false);
      const landed = board.locator(`[data-table-felt] [data-card="${card}"]`);
      await expect(landed).toBeVisible();
      await expect(landed).toHaveCSS('animation-name', /hearts-land/);
      await saveHeartsMetrics(page, info, rate);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(landed).toHaveCSS('animation-name', 'none');
      await board.screenshot({ path: info.outputPath('gesture-landing.png') });
    });
  });
}

test('Hearts gestures show the queen-bearing trick beside its winner', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHearts(page, 'screens-games-hearts-board--queen-taken', 'light');
  const board = page.getByTestId('custom-game-board');
  const seat = page.getByTestId('custom-game-board-seat-black');
  await expect(seat).toContainText('This trick +13');
  await expect(seat).toContainText('Score 20');
  await expect(board.locator('[data-table-felt] [data-card]')).toHaveCount(4);
  await expect(page.getByTestId('custom-game-board-center')).toContainText(
    'This trick added 13 deal points.'
  );
  await board.screenshot({ path: info.outputPath('queen-taken.png') });
});
