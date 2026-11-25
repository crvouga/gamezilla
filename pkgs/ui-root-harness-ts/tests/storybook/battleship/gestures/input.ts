import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { observePreview, savePreviewTime } from './preview-timing';

export async function center(cell: Locator) {
  const box = await cell.boundingBox();
  if (!box) throw new Error('Missing cell');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export async function snapshot(grid: Locator, info: TestInfo, name: string) {
  await info.attach(name + '-box', {
    body: JSON.stringify(await grid.boundingBox()),
    contentType: 'application/json',
  });
  await info.attach(name, {
    body: await grid.screenshot(),
    contentType: 'image/png',
  });
}
export async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return {
    send: (
      type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
      points: { x: number; y: number }[]
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map((p, i) => ({ ...p, id: i + 1 })),
      }),
    close: () => cdp.detach(),
  };
}
export async function dragShip(
  page: Page,
  grid: Locator,
  phone: boolean,
  info: TestInfo
) {
  const from = await center(grid.locator('[data-cell="c1"]'));
  const to = await center(grid.locator('[data-cell="c2"]'));
  const input = await touch(page);
  await observePreview(grid);
  try {
    if (phone) {
      await input.send('touchStart', [from]);
      await input.send('touchMove', [to]);
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
    }
    await expect(grid.locator('[data-cell="a2"]')).toHaveAttribute(
      'data-emphasis',
      'preview'
    );
    await savePreviewTime(grid, info);
    await snapshot(grid, info, 'drag-preview');
    if (phone) await input.send('touchEnd', []);
    else await page.mouse.up();
    await expect(grid.locator('[data-cell="a2"]')).toHaveAccessibleName(
      'A2: Carrier'
    );
    await expect(grid.locator('[data-cell="a1"]')).toHaveAccessibleName(
      'A1: open water'
    );
    await snapshot(grid, info, 'placed');
  } finally {
    await input.close();
  }
}
