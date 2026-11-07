// @io-wall-ok — automated review captures and browser performance observations.
import { expect, test } from '@playwright/test';
import { captureBoard, measureDrop, openBoard } from './capture';
import { finishTiming, startTiming } from './timing';

test.use({ video: 'on', trace: 'on', hasTouch: true });

for (const width of [320, 390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: connect-four review ${width} ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1024 });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const cdp = await page.context().newCDPSession(page);
      const cpuRate = width < 768 ? 4 : 1;
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      await openBoard(page, 'drop-a-disc', theme);
      await captureBoard(page, info, 'two-disc-drop');
      await startTiming(page);
      const samples: number[] = [];
      for (const column of [1, 2, 3, 5, 6, 7]) {
        samples.push(await measureDrop(page, column));
      }
      await page.getByTestId('custom-game-board-column-4').tap();
      await expect(
        page.getByTestId('custom-game-board-cell-17')
      ).toHaveAttribute('data-disc', '1');
      const longTasks = await finishTiming(page);
      await captureBoard(page, info, 'touch-drop');
      await info.attach('performance', {
        body: JSON.stringify(
          {
            cpuRate,
            samples,
            longTasks,
            metric: 'click capture to next requestAnimationFrame callback (ms)',
            limitation:
              'Synthetic CPU throttle; no physical-device or compositor presentation claim.',
          },
          null,
          2
        ),
        contentType: 'application/json',
      });
      await openBoard(page, 'full-column', theme);
      await captureBoard(page, info, 'full-column-keyboard-recovery');
      await openBoard(page, 'connect-four-to-win', theme);
      await captureBoard(page, info, 'winning-drop');
      await openBoard(page, 'watching', theme);
      const board = page.getByTestId('custom-game-board');
      const cells = await board.getAttribute('data-cells');
      await page.getByTestId('custom-game-board-column-4').tap();
      await expect(board).toHaveAttribute('data-cells', cells ?? '');
      await captureBoard(page, info, 'spectator');
      await openBoard(page, 'full-board-draw', theme);
      await captureBoard(page, info, 'draw');
      expect(errors).toEqual([]);
    });
  }
}
