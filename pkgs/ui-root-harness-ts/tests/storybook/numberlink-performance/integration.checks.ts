import { expect, test } from '@playwright/test';
import { attachJson, capture, openBoard } from '../numberlink-board/evidence';
import {
  reportMeasurements,
  startMeasurements,
} from '../numberlink-board/performance';
import { rowTargets } from './row-targets';

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
            // A straight row has equally spaced cells. Read its endpoints
            // before pickup so geometry queries never interrupt the stroke.
            const targets = await rowTargets(page, row);
            const { start, end } = targets;
            if (
              start.hit !== `numberlink-board-cell-${start.cell}` ||
              end.hit !== `numberlink-board-cell-${end.cell}` ||
              !targets.progress?.includes(`${row}/20 pairs connected`)
            ) {
              process.stdout.write(
                `numberlink-row-targets ${width} ${theme} row=${row + 1} ${JSON.stringify(targets)}\n`
              );
            }
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            await page.mouse.move(end.x, end.y, { steps: 19 });
            await page.mouse.up();
            process.stdout.write(
              `numberlink-dense-route ${width} ${theme} row=${row + 1} ms=${Date.now() - routeStart} total=${Date.now() - started}\n`
            );
          }
          await reportMeasurements(page, info, cpuRate);
          await session.detach();
          await expect(page.getByTestId('numberlink-progress')).toContainText(
            half.connected
          );
          await expect(page.getByTestId('numberlink-progress')).toContainText(
            `${half.rows[1] * 20}/400 cells covered`
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

// regression: numberlink-dense-board-moves-during-stroke
test('storybook integration: numberlink-performance dense routes second half 390 light keeps row 16 under the pointer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openBoard(page, 'light', HALVES[1].story);
  for (let row = 10; row < 15; row++) {
    const { start, end } = await rowTargets(page, row);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();
  }
  const progress = page.getByTestId('numberlink-progress');
  await expect(progress).toContainText(
    '15/20 pairs connected — 300/400 cells covered'
  );

  const { start, end } = await rowTargets(page, 15);
  const board = page.getByTestId('numberlink-board');
  const before = await board.boundingBox();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(page.getByTestId('numberlink-drawing-status')).toContainText(
    'Drawing 16.'
  );
  expect(await board.boundingBox()).toEqual(before);
  await page.mouse.move(end.x, end.y, { steps: 19 });
  await page.mouse.up();
  await expect(progress).toContainText(
    '16/20 pairs connected — 320/400 cells covered'
  );
  expect(await board.boundingBox()).toEqual(before);
});
