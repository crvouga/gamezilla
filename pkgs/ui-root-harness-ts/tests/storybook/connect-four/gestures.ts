// @io-wall-ok — hosted Chromium writes the measured board bounds and evidence.
import { writeFile } from 'node:fs/promises';
import { expect, type Page, type TestInfo, test } from '@playwright/test';
import { openBoard } from './capture';

type Point = { x: number; y: number };
const board = (page: Page) => page.getByTestId('custom-game-board');
const column = (page: Page, n: number) =>
  page.getByTestId(`custom-game-board-column-${n}`);
async function center(page: Page, n: number) {
  const box = await column(page, n).boundingBox();
  if (!box) throw Error('Missing column');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function capture(page: Page, info: TestInfo, name: string) {
  const rack = board(page);
  await rack.screenshot({ path: info.outputPath(name + '.png') });
  await writeFile(
    info.outputPath(name + '-box.json'),
    JSON.stringify(await rack.boundingBox())
  );
}
async function input(page: Page, touch: boolean) {
  const cdp = await page.context().newCDPSession(page);
  function fingers(
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: Point[]
  ) {
    return cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, i) => ({ ...p, id: i + 1 })),
    });
  }
  return {
    async start(p: Point) {
      if (touch) await fingers('touchStart', [p]);
      else {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
      }
    },
    async move(p: Point) {
      if (touch) await fingers('touchMove', [p]);
      else await page.mouse.move(p.x, p.y, { steps: 5 });
    },
    async release() {
      if (touch) await fingers('touchEnd', []);
      else await page.mouse.up();
    },
    fingers,
  };
}
async function slide(page: Page, info: TestInfo, touch: boolean) {
  const driver = await input(page, touch);
  const before = await board(page).getAttribute('data-cells');
  const played = board(page).locator('[data-cell]:not([data-disc="0"])');
  const count = await played.count();
  await driver.start(await center(page, 2));
  await expect(board(page)).toHaveAttribute('data-preview-cell', '1');
  await driver.move(await center(page, 4));
  await expect(board(page)).toHaveAttribute('data-preview-cell', '17');
  await expect(board(page)).toHaveAttribute('data-cells', before ?? '');
  await capture(page, info, 'aim');
  await driver.release();
  await expect(page.getByTestId('custom-game-board-cell-17')).toHaveAttribute(
    'data-disc',
    '1'
  );
  const after = await board(page).getAttribute('data-cells');
  await expect(played).toHaveCount(count + 1);
  await capture(page, info, 'placed');
  return { driver, after };
}
async function inspect(page: Page, info: TestInfo, touch: boolean) {
  const { driver, after } = await slide(page, info, touch);
  const p = await center(page, 4);
  const viewport = board(page).locator('[data-gestures]');
  const side = (offset: number) => ({ x: p.x + offset, y: p.y });
  if (touch) {
    await driver.start(side(-25));
    await driver.fingers('touchStart', [side(-25), side(25)]);
    await driver.fingers('touchMove', [side(-50), side(50)]);
    await driver.fingers('touchEnd', []);
  } else {
    // Start the trackpad pinch independently of any pressed button.
    await page.mouse.move(p.x, p.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
  }
  await expect(
    board(page).getByRole('button', { name: /Fit board/ })
  ).toBeVisible();
  const zoom = Number(await viewport.getAttribute('data-zoom'));
  expect(zoom).toBeGreaterThan(1);
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[data-column]')
          ?.getAttribute('data-column'),
      p
    )
  ).toBe('3');
  const prior = await column(page, 1).boundingBox();
  await driver.start(p);
  await driver.move(side(60));
  await driver.release();
  const next = await column(page, 1).boundingBox();
  expect(next?.x).toBeGreaterThan(prior?.x ?? 0);
  await capture(page, info, 'inspect');
  // Hit testing follows the transformed column. A click there only inspects.
  await driver.start(p);
  await driver.release();
  await expect(board(page)).toHaveAttribute('data-cells', after ?? '');
  for (let n = 0; n < 4; n++) {
    await driver.start(p);
    await driver.move(side(130));
    await driver.release();
  }
  const left = await column(page, 1).boundingBox();
  const frame = await viewport.boundingBox();
  if (!left || !frame) throw Error('Missing magnified rack');
  expect(Math.abs(left.x - frame.x)).toBeLessThan(1);

  await board(page)
    .getByRole('button', { name: /Fit board/ })
    .click();
  await expect(viewport).toHaveAttribute('data-zoom', '1');
  await expect(board(page)).toHaveAttribute('data-cells', after ?? '');
}
async function cancelAim(page: Page, touch: boolean) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBoard(page, 'drop-a-disc', touch ? 'light' : 'dark', 'system');
  const driver = await input(page, touch);
  const before = await board(page).getAttribute('data-cells');
  await driver.start(await center(page, 2));
  if (touch) await driver.fingers('touchCancel', []);
  else {
    await page.keyboard.press('Escape');
    await driver.release();
  }
  await expect(board(page)).toHaveAttribute('data-cells', before ?? '');
  await column(page, 2).focus();
  await page.keyboard.press('i');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(board(page)).toHaveAttribute('data-cells', before ?? '');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  const cell = page.getByTestId('custom-game-board-cell-1');
  await expect(cell).toHaveAttribute('data-disc', '1');
  await expect(cell.locator('span')).toHaveCSS('animation-name', 'none');
}
export function defineGestures(width: number) {
  test.describe(`Connect Four rack ${width}`, () => {
    test('storybook integration: connect-four canceled aim and keyboard inspection', async ({
      page,
    }) => cancelAim(page, width === 390));
    test('storybook integration: connect-four slide, inspect and fit', async ({
      page,
    }, info) => {
      await openBoard(
        page,
        'drop-a-disc',
        width === 390 ? 'light' : 'dark',
        'system'
      );
      await inspect(page, info, width === 390);
    });
  });
}
