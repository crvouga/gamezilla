import { expect, test } from '@playwright/test';
import { capture, openBoard } from '../numberlink-board/evidence';

test.use({ viewport: { width: 390, height: 844 } });

const STORY = 'screens-games-numberlink-catalog';

/** The shipped solution of "First threads 9", as cell indices on its 5 by 5 board. */
const ROUTES = [
  [0, 1, 2, 3, 4],
  [6, 5, 10, 15, 16],
  [7, 8, 13],
  [9, 14, 19, 24, 23, 22, 21, 20],
  [11, 12, 17, 18],
];

function routeKey(previous: number, current: number): string {
  const keys: Readonly<Record<number, string>> = {
    1: 'ArrowRight',
    [-1]: 'ArrowLeft',
    5: 'ArrowDown',
    [-5]: 'ArrowUp',
  };
  const key = keys[current - previous];
  if (key === undefined) throw new Error('Route cells must be neighbors');
  return key;
}

test('storybook integration: play the Numberlink catalog from First threads', async ({
  page,
}, info) => {
  await openBoard(page, `${STORY}--first-threads`);
  await expect(
    page.getByText('First threads 9', { exact: true }).first()
  ).toBeVisible();
  await capture(page, info, 'numberlink-catalog-start');
  for (const [start, ...steps] of ROUTES) {
    await page.getByTestId(`numberlink-board-cell-${start}`).focus();
    await page.keyboard.press('Enter');
    let previous = start ?? 0;
    for (const step of steps) {
      await page.keyboard.press(routeKey(previous, step));
      previous = step;
    }
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('numberlink-solved')).toBeVisible();
  await capture(page, info, 'numberlink-catalog-solved');
  await page.getByTestId('content-open-progress').click();
  await expect(page.getByTestId('puzzle-attempt-pack-place')).toHaveText(
    'Puzzle 9 of 32 in First threads'
  );
  await expect(page.getByTestId('content-next-puzzle')).toHaveText(
    'Next puzzle: First threads 10'
  );
  await capture(page, info, 'numberlink-catalog-pack');
});

for (const [story, name] of [
  ['marathon', 'numberlink-catalog-marathon'],
  ['marathon-solved', 'numberlink-catalog-marathon-solved'],
  ['open-fields-solved', 'numberlink-catalog-open-fields-solved'],
] as const)
  test(`storybook integration: Numberlink catalog ${story} fits a phone`, async ({
    page,
  }, info) => {
    await openBoard(page, `${STORY}--${story}`);
    const board = page.getByTestId('numberlink-board');
    await expect(board).toBeVisible();
    const box = await board.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
    if (story.endsWith('solved'))
      await expect(page.getByTestId('numberlink-solved')).toBeVisible();
    await capture(page, info, name);
  });
