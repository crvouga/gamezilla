import type { Locator, Page } from '@playwright/test';

export async function center(cell: Locator) {
  const box = await cell.boundingBox();
  if (!box) throw new Error('Board square missing');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
export type Point = Awaited<ReturnType<typeof center>>;

/** Send a native touch sequence; CDP lets both contacts belong to one gesture. */
export async function input(page: Page, phone: boolean) {
  const cdp = await page.context().newCDPSession(page);
  const touch = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel',
    points: Point[]
  ) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, id) => ({ ...p, id })),
    });
  const drag = async (
    start: Point,
    end: Point,
    during?: () => Promise<void>
  ) => {
    if (phone) await touch('touchStart', [start]);
    else {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
    }
    for (let step = 1; step <= 8; step++) {
      const p = {
        x: start.x + ((end.x - start.x) * step) / 8,
        y: start.y + ((end.y - start.y) * step) / 8,
      };
      if (phone) await touch('touchMove', [p]);
      else await page.mouse.move(p.x, p.y);
    }
    await during?.();
    if (phone) await touch('touchEnd', []);
    else await page.mouse.up();
  };
  return { touch, drag };
}
