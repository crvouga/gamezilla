import { expect, test } from '@playwright/test';
import { capture, mousePath, openBoard } from '../numberlink-board/evidence';
import {
  reportMeasurements,
  startMeasurements,
} from '../numberlink-board/performance';

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'off',
});

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
        for (let row = 0; row < 20; row++)
          await mousePath(
            page,
            Array.from({ length: 20 }, (_, column) => row * 20 + column)
          );
        await reportMeasurements(page, info, cpuRate);
        await session.detach();
        await expect(page.getByTestId('numberlink-progress')).toContainText(
          '20/20 pairs connected'
        );
        await expect(page.getByTestId('numberlink-solved')).toBeVisible();
        await capture(page, info, 'all-routes-complete');
        await info.attach('measurement-protocol', {
          body: JSON.stringify({
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
          }),
          contentType: 'application/json',
        });
      });
    });
