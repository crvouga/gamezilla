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

// Two halves of the same twenty-route journey, each well inside the
// default budget: the whole journey ran 22 to over 30 seconds on identical
// code across hosted runners. The second half opens with the first ten rows
// saved and ends with the board solved.
const HALVES = [
  {
    name: 'first half',
    story: 'screens-games-numberlink-puzzle--dense-board',
    rows: [0, 10],
    connected: '10/20 pairs connected',
  },
  {
    name: 'second half',
    story: 'screens-games-numberlink-puzzle--dense-board-half-drawn',
    rows: [10, 20],
    connected: '20/20 pairs connected',
  },
] as const;

for (const width of [390, 1440])
  for (const theme of ['light', 'dark'])
    test.describe(`${width} ${theme}`, () => {
      const viewport = { width, height: width < 768 ? 844 : 1024 };
      test.use({ viewport });
      for (const half of HALVES)
        test(`storybook integration: numberlink-performance dense routes ${half.name} ${width} ${theme}`, async ({
          page,
        }, info) => {
          await openBoard(page, theme, half.story);
          await capture(page, info, 'before-measurement');
          const cpuRate = width < 768 ? 4 : 1;
          const session = await startMeasurements(page, cpuRate);
          // Ten full native routes; screenshots and axe run outside the timed
          // interval. Video remains enabled, so encoding overhead is included.
          // Each route's duration reaches the log.
          const started = Date.now();
          for (let row = half.rows[0]; row < half.rows[1]; row++) {
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
            half.connected
          );
          if (half.rows[1] === 20)
            await expect(page.getByTestId('numberlink-solved')).toBeVisible();
          await capture(page, info, 'routes-complete');
          await attachJson(info, 'measurement-protocol', {
            routes: half.rows[1] - half.rows[0],
            cellsPerRoute: 20,
            cpuRate,
            video: true,
            trace: false,
            screenshotsDuringMeasurement: 0,
            axeDuringMeasurement: false,
            repeats: 1,
            limitations:
              'Single hosted sample per viewport/theme and half. rAF gaps are scheduling observations, not display presentation. Video encoding overhead remains. CPU throttle is not physical mobile hardware.',
          });
        });
    });
