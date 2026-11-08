// @io-wall-ok — automated review captures and browser performance observations.
import { expect, test } from '@playwright/test';
import {
  captureBoard,
  measureDrop,
  openBoard,
  touchSpectatorColumn,
} from './capture';
import { forEachBoard } from './matrix';
import { captureMixedInput } from './mixed-input';
import { finishTiming, startTiming } from './timing';

test.use({ video: 'on', trace: 'on', hasTouch: true });

forEachBoard((width, theme) => {
  test(`storybook integration: connect-four mixed input ${width} ${theme}`, async ({
    page,
  }, info) => {
    await captureMixedInput(page, info, theme);
  });
  test(`storybook integration: connect-four review ${width} ${theme}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const cdp = await page.context().newCDPSession(page);
    const cpuRate = width < 768 ? 4 : 1;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await openBoard(page, 'drop-a-disc', theme);
    await captureBoard(page, info, 'two-disc-drop');
    await startTiming(page);
    const samples: Awaited<ReturnType<typeof measureDrop>>[] = [];
    for (const column of [1, 2, 3, 5, 6, 7]) {
      samples.push(
        await measureDrop(
          page,
          column,
          column % 3 === 0 ? 'touch' : column % 3 === 1 ? 'keyboard' : 'click'
        )
      );
    }
    await page.getByTestId('custom-game-board-column-4').tap();
    await expect(page.getByTestId('custom-game-board-cell-17')).toHaveAttribute(
      'data-disc',
      '1'
    );
    const longTasks = await finishTiming(page);
    await captureBoard(page, info, 'touch-drop');
    await info.attach('performance', {
      body: JSON.stringify(
        {
          cpuRate,
          samples,
          longTasks,
          metric:
            'activation click capture to next requestAnimationFrame with updated board (ms)',
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
    const recovered = await page
      .getByTestId('custom-game-board')
      .getAttribute('data-cells');
    await page.getByTestId('custom-game-board-column-1').press('Enter');
    await expect(page.getByTestId('custom-game-board')).toHaveAttribute(
      'data-cells',
      recovered ?? ''
    );
    await captureBoard(page, info, 'full-column-refused');
    await openBoard(page, 'connect-four-to-win', theme);
    await captureBoard(page, info, 'winning-drop');
    await openBoard(page, 'watching', theme);
    const board = page.getByTestId('custom-game-board');
    const cells = await board.getAttribute('data-cells');
    await touchSpectatorColumn(page);
    await expect(board).toHaveAttribute('data-cells', cells ?? '');
    await captureBoard(page, info, 'spectator');
    await openBoard(page, 'full-board-draw', theme);
    await captureBoard(page, info, 'draw');
    expect(errors).toEqual([]);
  });
});

// regression: connect-four-evidence-waits-for-spectator-enable
test('storybook integration: connect-four spectator native touch remains inert', async ({
  page,
}) => {
  await openBoard(page, 'watching', 'light');
  const board = page.getByTestId('custom-game-board');
  const before = await board.getAttribute('data-cells');
  await touchSpectatorColumn(page);
  await expect(board).toHaveAttribute('data-cells', before ?? '');
});

forEachBoard((width, theme) => {
  for (const state of ['opening', 'waiting-for-opponent', 'lost']) {
    test(`storybook integration: connect-four ${state} ${width} ${theme}`, async ({
      page,
    }, info) => {
      await openBoard(page, state, theme);
      await captureBoard(page, info, state);
    });
  }
});
