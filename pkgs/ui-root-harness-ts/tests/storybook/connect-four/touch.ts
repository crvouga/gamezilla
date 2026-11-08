import { expect, type Page, type TestInfo } from '@playwright/test';
import { captureBoard, openBoard } from './capture';

/** Native touch cancellation and near-boundary hit tests, never forced clicks. */
export async function captureTouchEdges(
  page: Page,
  info: TestInfo,
  theme: string
) {
  await openBoard(page, 'drop-a-disc', theme);
  const board = page.getByTestId('custom-game-board');
  const before = await board.getAttribute('data-cells');
  const control = page.getByTestId('custom-game-board-column-2');
  const box = await control.boundingBox();
  if (!box) throw new Error('Column 2 is missing');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await expect(board).toHaveAttribute('data-cells', before ?? '');
  await captureBoard(page, info, 'canceled-touch');
  const hits = [];
  for (const [number, side, disc] of [
    [2, 'left', '1'],
    [6, 'right', '2'],
  ] as const) {
    const target = await page
      .getByTestId(`custom-game-board-column-${number}`)
      .boundingBox();
    if (!target) throw new Error(`Column ${number} is missing`);
    const point = {
      x: side === 'left' ? target.x + 2 : target.x + target.width - 2,
      y: target.y + target.height / 2,
    };
    const hit = await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest('[data-column]')
          ?.getAttribute('data-column'),
      point
    );
    expect(hit).toBe(String(number - 1));
    await page.touchscreen.tap(point.x, point.y);
    await expect(
      page.getByTestId(`custom-game-board-cell-${number - 1}`)
    ).toHaveAttribute('data-disc', disc);
    hits.push({ number, side, point, width: target.width, actualColumn: hit });
  }
  await info.attach('touch-hit-test', {
    body: JSON.stringify({ canceledWithoutDrop: true, hits }),
    contentType: 'application/json',
  });
  await captureBoard(page, info, 'touch-boundary-drops');
}
