// @io-wall-ok — automated Pong capture, never a manual playthrough.
import { expect, test } from '@playwright/test';
import { openPong, recordPong } from './evidence';
import { logVideo } from './log-evidence';
import { finishPongMetrics, startPongMetrics } from './metrics';

test.use({ video: 'on', trace: 'on' });

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const state of [
      'countdown',
      'rally',
      'serve-after-point',
      'match-point',
      'paused',
      'reconnecting',
      'two-players-on-one-device',
      'watching',
      'finished',
      'unreadable',
      'return-score-and-reconnect',
    ]) {
      test(`storybook integration: pong-overhaul ${state} ${width} ${theme}`, async ({
        page,
      }, info) => {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        await openPong(page, state, theme);
        await recordPong(page, info, `${state}-${width}-${theme}`);
      });
    }
  }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: pong-overhaul input ${viewport.width} ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await openPong(page, 'paddle-movement', theme);
      const court = page.getByRole('application', { name: 'Pong court' });
      const paddle = page.locator(
        'rect[data-side="first"][data-controlled="true"]'
      );
      const cpuRate = viewport.width < 1024 ? 4 : 1;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      // Discover the court through actual tab order, without synthetic key dispatch.
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Tab');
        if (
          await court.evaluate((element) => element === document.activeElement)
        )
          break;
      }
      await expect(court).toBeFocused();
      await startPongMetrics(page);
      for (let i = 0; i < 24; i++) {
        const before = Number(await paddle.getAttribute('y'));
        await page.keyboard.press(i % 2 === 0 ? 'ArrowDown' : 'ArrowUp');
        expect(Number(await paddle.getAttribute('y'))).not.toBe(before);
      }
      const box = await court.boundingBox();
      if (!box) throw new Error('Missing court geometry');
      await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 3, box.y + box.height / 4, {
        steps: 12,
      });
      await page.mouse.up();
      await finishPongMetrics(page, info, cpuRate);
      await recordPong(page, info, `keyboard-mouse-${viewport.width}-${theme}`);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await cdp.detach();
      await logVideo(page, `keyboard-mouse-${viewport.width}-${theme}`);
    });
  }
}
