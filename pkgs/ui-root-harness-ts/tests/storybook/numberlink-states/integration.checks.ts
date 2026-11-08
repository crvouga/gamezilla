import { expect, type Page, test } from '@playwright/test';
import {
  accessibility,
  capture,
  center,
  mousePath,
  openBoard,
} from '../numberlink-board/evidence';

function routeKey(previous: number | undefined, current: number | undefined) {
  if (current === undefined || previous === undefined)
    throw new Error('Missing deterministic route cell');
  const keys: Record<number, string> = {
    1: 'ArrowRight',
    '-1': 'ArrowLeft',
    5: 'ArrowDown',
    '-5': 'ArrowUp',
  };
  const key = keys[current - previous];
  if (key === undefined)
    throw new Error('Non-adjacent deterministic route cells');
  return key;
}

/** Each board cell's size and whether its endpoint label stays inside it. */
function cellGeometry(page: Page) {
  return page.getByTestId('numberlink-board').evaluate((board) => {
    const cells = [...board.querySelectorAll('button')];
    return cells.map((cell) => {
      const box = cell.getBoundingClientRect();
      const label = cell.querySelector('span');
      const range = document.createRange();
      if (label) range.selectNodeContents(label);
      const text = label ? range.getBoundingClientRect() : null;
      return {
        name: cell.getAttribute('aria-label'),
        width: box.width,
        height: box.height,
        labelFits:
          text === null || (text.left >= box.left && text.right <= box.right),
      };
    });
  });
}

// regression: numberlink-endpoint-labels-overflow-cells
test('storybook integration: numberlink-states labels fit narrow cells', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const story of ['dense-board', 'long-labels']) {
    await openBoard(page, 'dark', `screens-games-numberlink-puzzle--${story}`);
    await capture(page, info, `${story}-narrow`);
    const overflowing = (await cellGeometry(page))
      .filter((cell) => !cell.labelFits)
      .map((cell) => cell.name);
    expect(overflowing).toEqual([]);
  }
});

test.use({
  video: { mode: 'on', size: { width: 1440, height: 1024 } },
  trace: 'on',
  hasTouch: true,
});

for (const width of [320, 768, 1440])
  for (const theme of ['light', 'dark'])
    test.describe(`${width} ${theme}`, () => {
      const viewport = { width, height: width < 768 ? 844 : 1024 };
      test.use({ viewport });

      for (const story of ['dense-board', 'long-labels'])
        test(`storybook integration: numberlink-states ${story} ${width} ${theme}`, async ({
          page,
        }, info) => {
          await openBoard(
            page,
            theme,
            `screens-games-numberlink-puzzle--${story}`
          );
          await capture(page, info, 'fresh');
          const geometry = await cellGeometry(page);
          await info.attach('cell-geometry', {
            body: JSON.stringify(geometry),
            contentType: 'application/json',
          });
          const columns = story === 'dense-board' ? 20 : 5;
          await mousePath(
            page,
            Array.from({ length: columns }, (_, index) => index)
          );
          await capture(page, info, 'first-pair-connected');
          await expect(page.getByTestId('numberlink-progress')).toContainText(
            `1/${columns} pairs connected`
          );
          await accessibility(page, info);
          expect(geometry.every((cell) => cell.labelFits)).toBe(true);
        });

      test(`storybook integration: numberlink-states disabled inspection ${width} ${theme}`, async ({
        page,
      }, info) => {
        await openBoard(
          page,
          theme,
          'screens-games-numberlink-puzzle--disabled'
        );
        await capture(page, info, 'disabled');
        await mousePath(page, [0, 1, 2, 3, 8, 13]);
        const first = page.getByTestId('numberlink-board-cell-0');
        await first.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('numberlink-board-cell-1')).toBeFocused();
        await expect(
          page.getByTestId('numberlink-board-cell-1')
        ).toHaveAccessibleName('B1: empty');
        await expect(first).toHaveAttribute('aria-disabled', 'true');
        await expect(page.getByTestId('numberlink-progress')).toContainText(
          '0/5 pairs connected'
        );
        await capture(page, info, 'inspected-without-drawing');
        await accessibility(page, info);
      });

      test(`storybook integration: numberlink-states complete with native keyboard ${width} ${theme}`, async ({
        page,
      }, info) => {
        await openBoard(page, theme);
        await capture(page, info, 'fresh');
        for (const path of [
          [0, 1, 2, 3, 8, 13],
          [4, 9, 14, 19, 18],
          [5, 6, 7, 12, 17],
          [10, 11, 16],
          [15, 20, 21, 22, 23, 24],
        ]) {
          await page.getByTestId(`numberlink-board-cell-${path[0]}`).focus();
          await page.keyboard.press('Enter');
          for (let index = 1; index < path.length; index++) {
            await page.keyboard.press(routeKey(path[index - 1], path[index]));
          }
          await page.keyboard.press('Enter');
        }
        await expect(page.getByTestId('numberlink-solved')).toBeVisible();
        await expect(page.getByTestId('numberlink-progress')).toContainText(
          '5/5 pairs connected'
        );
        await expect(page.getByTestId('numberlink-progress')).toContainText(
          '25/25 cells covered'
        );
        await capture(page, info, 'solved');
        await accessibility(page, info);
      });

      test(`storybook integration: numberlink-states touch interruption ${width} ${theme}`, async ({
        page,
      }, info) => {
        await openBoard(page, theme);
        await mousePath(page, [0, 1, 2, 3, 8, 13]);
        await capture(page, info, 'saved-before-interruption');
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ ...(await center(page, 5)), id: 1 }],
        });
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ ...(await center(page, 6)), id: 1 }],
        });
        await capture(page, info, 'provisional');
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchCancel',
          touchPoints: [],
        });
        await session.detach();
        await expect(
          page.getByTestId('numberlink-board-cell-6')
        ).toHaveAccessibleName('B2: empty');
        await expect(page.getByTestId('numberlink-progress')).toContainText(
          '1/5 pairs connected'
        );
        await capture(page, info, 'interrupted-saved-path-retained');
        await accessibility(page, info);
      });
    });
