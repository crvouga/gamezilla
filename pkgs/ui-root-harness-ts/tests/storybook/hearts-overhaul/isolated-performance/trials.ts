// @io-wall-ok — isolated browser measurement; canonical runner owns cleanup.
import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { attachHeartsText } from '../attachments';
import {
  captureHearts,
  HEARTS_TIMING_CONDITIONS,
  openHearts,
} from '../evidence';
import { readHeartsMetrics, startHeartsMetrics } from '../metrics';
import { exerciseHeartsTrick } from './inputs';

export async function measureHeartsTrials(
  page: Page,
  info: TestInfo,
  width: number
) {
  const trialCount = 5;
  const trialTimeout = info.timeout;
  test.setTimeout(trialTimeout * (trialCount + 1));
  const rate = width < 768 ? 4 : 1;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const trials = [];
  for (let trial = 1; trial <= trialCount; trial++) {
    const samples = await test.step(
      `Complete trick ${trial}`,
      async () => {
        await openHearts(
          page,
          'screens-games-hearts-interaction--pass-and-play'
        );
        await startHeartsMetrics(page);
        await exerciseHeartsTrick(page, width < 1024);
        return readHeartsMetrics(page);
      },
      { timeout: trialTimeout }
    );
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
        cpuThrottle: rate,
        conditions: HEARTS_TIMING_CONDITIONS,
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
}
