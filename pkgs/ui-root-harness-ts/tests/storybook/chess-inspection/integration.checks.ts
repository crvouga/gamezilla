import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { openChessStory, squareCenter } from '../chess/evidence';

import { recordNavigation } from './timing';

test.use({ hasTouch: true, video: 'on', trace: 'on' });

const viewport = (page: Page) => page.locator('[data-chess-inspection]');
async function capture(page: Page, info: TestInfo, name: string) {
  await info.attach(name, {
    body: await viewport(page).screenshot(),
    contentType: 'image/png',
  });
}

async function holdPawnAtDestination(page: Page, phone: boolean) {
  const from = await squareCenter(page, 'e2');
  const to = await squareCenter(page, 'e4');
  const x = to.x + 8;
  const y = to.y - 8;
  if (!phone) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 });
    return () => page.mouse.up();
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [from],
  });
  for (let step = 1; step <= 12; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((x - from.x) * step) / 12,
          y: from.y + ((y - from.y) * step) / 12,
        },
      ],
    });
  }
  return async () => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await cdp.detach();
  };
}
async function dragPawn(
  page: Page,
  info: TestInfo,
  reduced: boolean,
  phone: boolean
) {
  const release = await holdPawnAtDestination(page, phone);
  await capture(page, info, 'over-e4');
  const settling = await page.evaluateHandle(() => ({
    done: new Promise<number[]>((resolve) => {
      window.addEventListener(
        'pointerup',
        () => {
          const piece = document.querySelector('[data-piece-square="e4"]');
          resolve(
            (piece?.getAnimations() ?? []).map((a) =>
              Number(a.effect?.getTiming().duration)
            )
          );
        },
        { once: true }
      );
    }),
  }));
  await release();
  const durations = await settling.evaluate((s) => s.done);
  await settling.dispose();
  if (reduced) expect(durations).toEqual([]);
  else expect(durations.some((ms) => ms > 0 && ms <= 200)).toBe(true);
  await info.attach('release-motion', {
    body: JSON.stringify(durations),
    contentType: 'application/json',
  });
  await expect(page.locator('[data-piece-square="e4"]')).toHaveAttribute(
    'data-piece',
    'wp'
  );
  await capture(page, info, 'e4-landed');
}

async function pinch(page: Page, info: TestInfo) {
  const cdp = await page.context().newCDPSession(page);
  const pawn = { ...(await squareCenter(page, 'e2')), id: 1 };
  const other = { ...(await squareCenter(page, 'c4')), id: 2 };
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchCancel',
    touchPoints: (typeof pawn)[]
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  await send('touchStart', [pawn]);
  await send('touchStart', [pawn, other]);
  for (let step = 1; step <= 6; step++) {
    await send('touchMove', [
      { ...pawn, x: pawn.x + step * 5 },
      { ...other, x: other.x - step * 6, y: other.y - step * 4 },
    ]);
  }
  await expect(viewport(page)).toHaveAttribute(
    'data-chess-inspection',
    'magnified'
  );
  await capture(page, info, 'pinch-midpoint');
  await send('touchCancel', []);
  const actual = await squareCenter(page, 'd4');
  await page.touchscreen.tap(actual.x, actual.y);
  await expect(viewport(page).getByText('d4, empty')).toBeVisible();
  await capture(page, info, 'inspect-d4');
  const fit = page.getByRole('button', { name: 'Fit board' });
  await expect(fit).toBeVisible();
  await fit.tap();
  await expect(page.locator('[data-piece-square="e2"]')).toHaveAttribute(
    'data-piece',
    'wp'
  );
  await cdp.detach();
}

async function trackpad(page: Page, info: TestInfo) {
  const point = await squareCenter(page, 'c4');
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await page.keyboard.up('Control');
  await expect(viewport(page)).toHaveAttribute(
    'data-chess-inspection',
    'magnified'
  );
  await page.mouse.wheel(30, 40);
  await capture(page, info, 'trackpad-pan');
  await page.keyboard.press('Escape');
  await expect(viewport(page)).toHaveAttribute('data-chess-inspection', 'fit');
}

for (const width of [390, 1440]) {
  test.describe(`chess inspection ${width}`, () => {
    test.use({
      viewport: { width, height: 900 },
    });
    for (const motion of ['reduce', 'no-preference'] as const) {
      test(`chess inspection cancels the gesture then resumes play with ${motion}`, async ({
        page,
      }, info) => {
        await page.emulateMedia({ reducedMotion: motion });
        await openChessStory(
          page,
          'product-chessboard--gesture-play',
          motion === 'reduce' ? 'reduced' : 'system'
        );
        await capture(page, info, 'fitted');
        const finishTiming = await recordNavigation(page, info);
        if (width === 390) await pinch(page, info);
        else await trackpad(page, info);
        await finishTiming();
        await expect(viewport(page)).toHaveAttribute(
          'data-chess-inspection',
          'fit'
        );
        await dragPawn(page, info, motion === 'reduce', width === 390);
      });
    }
  });
}
