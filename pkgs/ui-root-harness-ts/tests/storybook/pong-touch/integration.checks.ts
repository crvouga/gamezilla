// @io-wall-ok — Chromium's native touch protocol drives the production court.
import { expect, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';
import { logVideo } from '../pong-overhaul/log-evidence';

test.use({ video: 'on', trace: 'on', hasTouch: true });

for (const theme of ['light', 'dark']) {
  test(`storybook integration: pong-overhaul simultaneous touch ${theme}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPong(page, 'shared-paddle-movement', theme);
    const court = page.getByRole('application');
    const box = await court.boundingBox();
    if (!box) throw new Error('Missing court');
    const left = page.locator('rect[data-side="first"][data-controlled]');
    const right = page.locator('rect[data-side="second"][data-controlled]');
    const initial = [
      Number(await left.getAttribute('y')),
      Number(await right.getAttribute('y')),
    ];
    const cdp = await page.context().newCDPSession(page);
    const points = (step: number) => [
      {
        id: 1,
        x: box.x + box.width / 4,
        y: box.y + box.height * (0.5 - step / 60),
      },
      {
        id: 2,
        x: box.x + box.width * 0.75,
        y: box.y + box.height * (0.5 + step / 60),
      },
    ];
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: points(0),
    });
    for (let step = 1; step <= 12; step++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(step),
      });
    expect(Number(await left.getAttribute('y'))).toBeLessThan(initial[0] ?? 0);
    expect(Number(await right.getAttribute('y'))).toBeGreaterThan(
      initial[1] ?? 0
    );
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: points(12).slice(1),
    });
    const releasedLeft = Number(await left.getAttribute('y'));
    const heldRight = Number(await right.getAttribute('y'));
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(18).slice(1),
    });
    expect(Number(await left.getAttribute('y'))).toBe(releasedLeft);
    expect(Number(await right.getAttribute('y'))).toBeGreaterThan(heldRight);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchCancel',
      touchPoints: [],
    });
    await recordPong(page, info, `simultaneous-touch-${theme}`);
    await info.attach('touch-task-completion', {
      body: JSON.stringify({
        twoPaddlesMoved: true,
        releaseIndependent: true,
        nativeCancelSent: true,
      }),
      contentType: 'application/json',
    });
    await cdp.detach();
    await logVideo(page, `simultaneous-touch-${theme}`);
  });
}
