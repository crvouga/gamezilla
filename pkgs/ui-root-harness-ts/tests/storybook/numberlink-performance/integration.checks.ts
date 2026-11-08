import { expect, test } from '@playwright/test';
import {
  attachJson,
  capture,
  mousePath,
  openBoard,
} from '../numberlink-board/evidence';
import {
  reportMeasurements,
  startMeasurements,
} from '../numberlink-board/performance';

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'off',
});

// The measurement is each input's latency, recorded below, not the run's
// length: 400 throttled inputs with video on ran 22 to over 30 seconds on
// identical code across hosted runners, so the default budget failed runs
// at random rather than flagging a slower board.
test.setTimeout(90_000);

for (const width of [390, 1440])
  for (const theme of ['light', 'dark'])
    test.describe(`${width} ${theme}`, () => {
      const viewport = { width, height: width < 768 ? 844 : 1024 };
      test.use({ viewport });
      test(`storybook integration: numberlink-performance repeated dense routes ${width} ${theme}`, async ({
        page,
      }, info) => {
        await openBoard(
          page,
          theme,
          'screens-games-numberlink-puzzle--dense-board'
        );
        await capture(page, info, 'before-measurement');
        const cpuRate = width < 768 ? 4 : 1;
        const session = await startMeasurements(page, cpuRate);
        // Twenty full native routes; screenshots and axe run outside the timed interval.
        // Video remains enabled, so encoding overhead is not isolated from results.
        // Each route's duration reaches the log, so a run that overruns its
        // budget still shows where the time went.
        const started = Date.now();
        for (let row = 0; row < 20; row++) {
          const routeStart = Date.now();
          await mousePath(
            page,
            Array.from({ length: 20 }, (_, column) => row * 20 + column)
          );
          process.stdout.write(
            `numberlink-dense-route ${width} ${theme} row=${row + 1} ms=${Date.now() - routeStart} total=${Date.now() - started}\n`
          );
        }
        await reportMeasurements(page, info, cpuRate);
        await session.detach();
        await expect(page.getByTestId('numberlink-progress')).toContainText(
          '20/20 pairs connected'
        );
        await expect(page.getByTestId('numberlink-solved')).toBeVisible();
        await capture(page, info, 'all-routes-complete');
        await attachJson(info, 'measurement-protocol', {
          routes: 20,
          cellsPerRoute: 20,
          cpuRate,
          video: true,
          trace: false,
          screenshotsDuringMeasurement: 0,
          axeDuringMeasurement: false,
          repeats: 1,
          limitations:
            'Single hosted sample per viewport/theme. rAF gaps are scheduling observations, not display presentation. Video encoding overhead remains. CPU throttle is not physical mobile hardware.',
        });
      });
    });
