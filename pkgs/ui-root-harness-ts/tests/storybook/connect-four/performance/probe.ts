// @io-wall-ok — evidence adapter owns retained files and browser CPU profiling.
import { mkdir, writeFile } from 'node:fs/promises';
import { expect, type TestInfo, test } from '@playwright/test';
import { measureDrop, openBoard } from '../capture';
import { finishTiming, startTiming } from '../timing';

async function retain(info: TestInfo, name: string, data: unknown) {
  await mkdir(info.outputDir, { recursive: true });
  const path = info.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(data, null, 2));
  await info.attach(name, { path, contentType: 'application/json' });
}

export function defineProfiles(recorded: boolean) {
  for (const theme of ['light', 'dark']) {
    test(`storybook integration: connect-four performance ${recorded ? 'recorded' : 'unrecorded'} ${theme}`, async ({
      page,
    }, info) => {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
      const epochs = [];
      for (let epoch = 0; epoch < 3; epoch++) {
        await openBoard(page, 'drop-a-disc', theme);
        // Two real moves warm the interaction path; retain every subsequent sample.
        await page.getByTestId('custom-game-board-column-1').click();
        await page.getByTestId('custom-game-board-column-2').click();
        await startTiming(page);
        await cdp.send('Profiler.start');
        const samples = [];
        for (const [column, input] of [
          [1, 'keyboard'],
          [2, 'click'],
          [3, 'touch'],
          [5, 'keyboard'],
          [6, 'click'],
          [7, 'touch'],
        ] as const) {
          samples.push(await measureDrop(page, column, input));
        }
        const profile = await cdp.send('Profiler.stop');
        const longTasks = await finishTiming(page);
        await retain(info, `cpu-profile-${epoch}`, profile.profile);
        expect(
          samples.every(
            (sample) =>
              Number.isFinite(sample.nativeInputToFrameMilliseconds) &&
              sample.nativeInputToFrameMilliseconds >= sample.milliseconds
          )
        ).toBe(true);
        epochs.push({ epoch, samples, longTasks });
      }
      await retain(info, 'controlled-performance', {
        recorded,
        theme,
        cpuRate: 4,
        viewport: { width: 390, height: 844 },
        epochs,
        metric:
          'native pointerdown/keydown event timestamp and activation click capture to next requestAnimationFrame with changed board',
        limitations:
          'Synthetic throttle, sampling profiler overhead, no compositor or physical-device claim. Compare recorded and unrecorded conditions; three separately warmed deterministic games, no timing outliers discarded.',
      });
    });
  }
}
