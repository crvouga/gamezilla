// @io-wall-ok — automated Pong capture in real time, never a manual playthrough.
import { expect, type Page, test } from '@playwright/test';
import { openPong, recordPong } from '../pong-overhaul/evidence';
import { logSummary, logVideo } from '../pong-overhaul/log-evidence';
import { finishPongMetrics, startPongMetrics } from '../pong-overhaul/metrics';

test.use({ video: 'on', trace: 'on' });

const paddleY = (page: Page) =>
  page
    .locator('rect[data-side="first"][data-controlled="true"]')
    .evaluate((element) => Number(element.getAttribute('y')));

const frames = (page: Page, count: number) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const next = () =>
          --left <= 0 ? resolve() : requestAnimationFrame(next);
        requestAnimationFrame(next);
      }),
    count
  );

// Responsiveness while the ball is moving: keys reach the court without
// tabbing to it, held keys move the paddle every tick, then a continuous
// drag. Three runs per condition, each its own page.
for (const condition of [
  { width: 390, height: 844, cpuRate: 4 },
  { width: 844, height: 390, cpuRate: 4 },
  { width: 1440, height: 900, cpuRate: 1 },
])
  for (const run of [1, 2, 3])
    test(`storybook integration: pong-overhaul live rally ${condition.width} run ${run}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(condition);
      await openPong(page, 'live-rally', 'light');
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: condition.cpuRate,
      });
      const court = page.getByRole('application', { name: 'Pong court' });
      await startPongMetrics(page);
      // Nothing is focused: the first paddle key starts play on the court.
      await page.keyboard.press('ArrowDown');
      await expect(court).toBeFocused();
      const ball = page.getByTestId('custom-game-board-ball');
      const ballBefore = await ball.getAttribute('data-ball-x');
      for (const key of ['ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowUp']) {
        await page.keyboard.down(key);
        await frames(page, 12);
        await page.keyboard.up(key);
      }
      // Twenty-four short taps, as a player correcting their aim does.
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press(i % 2 === 0 ? 'ArrowUp' : 'ArrowDown');
        await frames(page, 1);
      }
      const box = await court.boundingBox();
      if (!box) throw new Error('Missing court geometry');
      await page.mouse.move(box.x + box.width / 4, box.y + box.height * 0.8);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 4, box.y + box.height * 0.2, {
        steps: 30,
      });
      await page.mouse.up();
      // The rally really ran while all of this was measured.
      expect(await ball.getAttribute('data-ball-x')).not.toBe(ballBefore);
      await finishPongMetrics(page, info, condition.cpuRate);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
      if (run === 1) {
        await recordPong(page, info, `live-rally-${condition.width}`);
        await logVideo(page, `live-rally-${condition.width}`);
      }
    });

// A held key stops moving the paddle when the window loses focus, and the
// paddle stays still until a fresh press, although the key is still down.
test('storybook integration: pong-overhaul live rally releases a held key on blur', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPong(page, 'live-rally', 'light');
  await page.keyboard.down('ArrowDown');
  await frames(page, 10);
  const heldStart = await paddleY(page);
  await frames(page, 10);
  const heldEnd = await paddleY(page);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await frames(page, 6);
  const blurStart = await paddleY(page);
  await frames(page, 20);
  const blurEnd = await paddleY(page);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.down('ArrowUp');
  await frames(page, 10);
  const resumed = await paddleY(page);
  await page.keyboard.up('ArrowUp');
  const result = {
    movedWhileHeld: heldEnd > heldStart,
    stillAfterBlur: blurEnd === blurStart,
    movesAfterFreshPress: resumed < blurEnd,
    y: { heldStart, heldEnd, blurStart, blurEnd, resumed },
    method:
      'window blur dispatched in the page while ArrowDown stays physically down',
  };
  logSummary('PONG_BLUR', result);
  await info.attach('blur-release', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(result.movedWhileHeld).toBe(true);
  expect(result.stillAfterBlur).toBe(true);
  expect(result.movesAfterFreshPress).toBe(true);
  await logVideo(page, 'live-rally-blur-release');
});

// Disconnecting stops control and drops held input; restoring gives control
// back at once, and the paddle answers the next fresh press.
test('storybook integration: pong-overhaul reconnect returns control promptly', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPong(page, 'return-score-and-reconnect', 'light');
  const court = page.getByRole('application', { name: 'Pong court' });
  await court.focus();
  await page.keyboard.down('ArrowUp');
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(court).toHaveAttribute('data-interactive', 'false');
  await expect(page.getByTestId('custom-game-board-status')).toHaveAttribute(
    'data-stage',
    'reconnecting'
  );
  await page.keyboard.up('ArrowUp');
  const restore = page.getByRole('button', { name: 'Restore connection' });
  // Time, in the page, from the restoring click to the court taking input.
  await restore.evaluate((button) => {
    const court = document.querySelector('[data-component="PaddleCourt"]');
    if (!court) throw new Error('Missing Pong court');
    const timing = { clicked: 0, interactive: 0 };
    (window as unknown as { reconnect: typeof timing }).reconnect = timing;
    button.addEventListener(
      'click',
      () => {
        timing.clicked = performance.now();
      },
      { capture: true }
    );
    new MutationObserver(() => {
      if (
        court.getAttribute('data-interactive') === 'true' &&
        !timing.interactive
      )
        timing.interactive = performance.now();
    }).observe(court, {
      attributes: true,
      attributeFilter: ['data-interactive'],
    });
  });
  const before = await paddleY(page);
  await restore.click();
  await expect(court).toHaveAttribute('data-interactive', 'true');
  const held = await paddleY(page);
  await court.focus();
  await page.keyboard.press('ArrowUp');
  const after = await paddleY(page);
  const timing = await page.evaluate(
    () =>
      (
        window as unknown as {
          reconnect: { clicked: number; interactive: number };
        }
      ).reconnect
  );
  const result = {
    restoreToControlMs: timing.interactive - timing.clicked,
    // The journey advances only on input: nothing moves until a fresh press.
    stillUntilFreshPress: held === before,
    freshPressMoves: after < held,
  };
  logSummary('PONG_RECONNECT', result);
  await info.attach('reconnect-timing', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  await recordPong(page, info, 'reconnect-restored');
  expect(result.stillUntilFreshPress).toBe(true);
  expect(result.freshPressMoves).toBe(true);
  // Control returns within a frame of restoring the connection.
  expect(result.restoreToControlMs).toBeLessThanOrEqual(16.7);
  await logVideo(page, 'reconnect-restored');
});
