// @io-wall-ok — Chromium drives the production court with native devices.
import { writeFile } from 'node:fs/promises';
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test';
import { openPong } from '../pong-overhaul/evidence';

async function bounds(element: Locator) {
  const rect = await element.boundingBox();
  if (!rect) throw new Error('Pong court is missing');
  return rect;
}

async function recordBoard(court: Locator, info: TestInfo, name: string) {
  await court.screenshot({ path: info.outputPath(`${name}.png`) });
  await writeFile(
    info.outputPath('court-bounds.json'),
    JSON.stringify(await bounds(court))
  );
}

async function pinch(page: Page, court: Locator) {
  const rect = await bounds(court);
  const x = rect.x + rect.width * 0.35;
  const y = rect.y + rect.height * 0.4;
  const session = await page.context().newCDPSession(page);
  const touches = (radius: number) => [
    { id: 1, x: x - radius, y },
    { id: 2, x: x + radius, y },
  ];
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touches(16),
  });
  for (const radius of [18, 20, 22, 24, 26, 28, 30, 32])
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touches(radius),
    });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: touches(32).slice(1),
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await session.detach();
  return { x, y };
}

async function wheel(page: Page, court: Locator) {
  const rect = await bounds(court);
  const x = rect.x + rect.width * 0.35;
  const y = rect.y + rect.height * 0.4;
  await page.mouse.move(x, y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -210);
  await page.keyboard.up('Control');
  return { x, y };
}

async function inspect(page: Page, info: TestInfo, phone: boolean) {
  await openPong(page, 'watching', 'dark');
  const court = page.getByRole('application', { name: 'Pong court' });
  const drawing = court.locator('svg[data-testid$="-drawing"]');
  const fit = await bounds(drawing);
  await recordBoard(court, info, 'fit');
  await court.getByRole('button', { name: 'Inspect court' }).click();
  const anchor = phone ? await pinch(page, court) : await wheel(page, court);
  await expect
    .poll(async () => (await bounds(drawing)).width / fit.width)
    .toBeGreaterThan(1.85);
  const zoom = await bounds(drawing);
  const scale = zoom.width / fit.width;
  // The same point in the drawing remains under the gesture's focal point.
  expect(
    Math.abs((anchor.x - zoom.x) / scale - (anchor.x - fit.x))
  ).toBeLessThan(3);
  expect(
    Math.abs((anchor.y - zoom.y) / scale - (anchor.y - fit.y))
  ).toBeLessThan(3);
  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.down();
  await page.mouse.move(fit.x + fit.width - 4, anchor.y, { steps: 12 });
  await page.mouse.up();
  expect(Math.abs((await bounds(drawing)).x - fit.x)).toBeLessThan(2);
  await recordBoard(court, info, 'inspection');
  const reset = court.getByRole('button', { name: 'Fit court' });
  await reset.focus();
  await page.keyboard.press('ArrowRight');
  expect((await bounds(drawing)).x).toBeLessThan(fit.x);
  await page.keyboard.press('Escape');
  await expect(
    court.getByRole('button', { name: 'Inspect court' })
  ).toBeVisible();
  expect((await bounds(drawing)).width).toBeCloseTo(fit.width, 0);
  await expect(court.locator('[data-controlled="true"]')).toHaveCount(0);
}

async function steer(page: Page, info: TestInfo, reduced: boolean) {
  await page.emulateMedia({
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await openPong(page, 'paddle-movement', 'dark');
  const court = page.getByRole('application', { name: 'Pong court' });
  const paddle = court.locator(
    'rect[data-side="first"][data-controlled="true"]'
  );
  await expect(
    court.getByRole('button', { name: 'Inspect court' })
  ).toHaveCount(0);
  const fit = await bounds(court);
  await recordBoard(court, info, 'released');
  const x = fit.x + fit.width / 4;
  const touch =
    page.viewportSize()?.width === 390
      ? await page.context().newCDPSession(page)
      : undefined;
  if (touch)
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y: fit.y + fit.height * 0.4 }],
    });
  else {
    await page.mouse.move(x, fit.y + fit.height * 0.4);
    await page.mouse.down();
  }
  const before = Number(await paddle.getAttribute('y'));
  if (touch) {
    for (let i = 1; i <= 12; i++)
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: fit.y + fit.height * (0.4 + (0.32 * i) / 12) }],
      });
  } else await page.mouse.move(x, fit.y + fit.height * 0.72, { steps: 12 });
  expect(Number(await paddle.getAttribute('y'))).toBeGreaterThan(before);
  await expect(court).toHaveAttribute('data-held-first', 'true');
  const timing = await paddle.evaluate((p) =>
    parseFloat(getComputedStyle(p).transitionDuration)
  );
  expect(timing > 0).toBe(!reduced);
  await recordBoard(court, info, 'held');
  if (touch) {
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await touch.detach();
  } else await page.mouse.up();
  await expect(court).toHaveAttribute('data-held-first', 'false');
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test.describe(`storybook integration: pong-overhaul gestures ${viewport.width}`, () => {
    test.use({
      viewport,
      hasTouch: viewport.width === 390,
      video: { mode: 'on', size: viewport },
    });
    test('inspect around the gesture and return to fit', ({ page }, info) =>
      inspect(page, info, viewport.width === 390));
    test('name the controlled end before the serve', async ({ page }, info) => {
      await openPong(page, 'countdown', 'dark');
      const court = page.getByRole('application', { name: 'Pong court' });
      await expect(
        court.locator('[data-testid$="-first-gesture"]')
      ).toContainText('Left paddle');
      await recordBoard(court, info, 'serve');
    });
    test('steer without lagging the pointer', ({ page }, info) =>
      steer(page, info, false));
    test('steer with reduced motion', ({ page }, info) =>
      steer(page, info, true));
  });
}
