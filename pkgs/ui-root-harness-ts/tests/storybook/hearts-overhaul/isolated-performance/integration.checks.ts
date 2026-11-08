// @io-wall-ok — isolated browser measurement; canonical runner owns cleanup.
import { expect, test } from '@playwright/test';
import { attachHeartsText } from '../attachments';
import { captureHearts, openHearts } from '../evidence';
import { readHeartsMetrics, startHeartsMetrics } from '../metrics';
import { exerciseHeartsTrick } from './inputs';

// The separate recorded journeys retain videos/traces. This measurement
// deliberately excludes that instrumentation and screenshots during input.
test.use({ trace: 'off', video: 'off' });

for (const width of [320, 390, 768, 1440]) {
  for (const theme of ['light', 'dark']) {
    test.describe(`Hearts isolated latency ${width} ${theme}`, () => {
      test.use({
        viewport: { width, height: width === 320 ? 568 : 900 },
        hasTouch: width < 1024,
      });
      test('storybook integration: Hearts repeated input timing without recording overhead', async ({
        page,
      }, info) => {
        const rate = width < 768 ? 4 : 1;
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const trials = [];
        for (const _trial of [0, 1, 2, 3, 4]) {
          await openHearts(
            page,
            'screens-games-hearts-interaction--pass-and-play',
            theme
          );
          await startHeartsMetrics(page);
          await exerciseHeartsTrick(page, width < 1024);
          const samples = await readHeartsMetrics(page);
          expect(samples.inputs).toHaveLength(9);
          trials.push(samples);
        }
        const sorted = trials
          .flatMap((trial) => trial.inputs.map((input) => input.milliseconds))
          .sort((a, b) => a - b);
        await attachHeartsText(
          info,
          'isolated-input-render-metrics.json',
          JSON.stringify(
            {
              measurement: 'Trusted input to second frame; not INP',
              viewport: page.viewportSize(),
              theme,
              cpuThrottle: rate,
              browser: page.context().browser()?.version(),
              recording: {
                trace: false,
                video: false,
                screenshotsDuringInput: false,
              },
              sampleCount: sorted.length,
              p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
              p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
              maximum: sorted.at(-1),
              trials,
              limits:
                'Five repeated deterministic fixture trials on one hosted runner; CPU emulation is not a physical device. Startup and transport are outside this measurement.',
            },
            null,
            2
          )
        );
        await captureHearts(page, info, 'isolated-trick-complete');
      });
    });
  }
}
