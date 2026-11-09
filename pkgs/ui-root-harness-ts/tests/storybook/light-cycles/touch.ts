import { expect, type Page } from '@playwright/test';

/** Two overlapping trusted touch lifetimes, each steering its original half. */
export async function sharedNativeTouch(page: Page) {
  const arena = page.getByTestId('custom-game-board-arena');
  const bounds = await arena.boundingBox();
  if (!bounds) throw new Error('Missing touch arena');
  await arena.evaluate((element) => {
    const pointers = new Set<number>();
    element.addEventListener('pointermove', (event) => {
      if (
        !(event instanceof PointerEvent) ||
        !event.isTrusted ||
        event.pointerType !== 'touch'
      )
        return;
      pointers.add(event.pointerId);
      element.setAttribute(
        'data-trusted-touch-pointers',
        String(pointers.size)
      );
    });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 2,
  });
  const y = bounds.y + bounds.height / 2;
  const left = { id: 11, x: bounds.x + bounds.width / 4, y };
  const right = { id: 12, x: bounds.x + (bounds.width * 3) / 4, y };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [left, right],
  });
  right.x += 32;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [left, right],
  });
  await expect(
    page.getByTestId('custom-game-board-arena-rider-0')
  ).toHaveAttribute('data-heading', 'right');
  await expect(
    page.getByTestId('custom-game-board-arena-rider-1')
  ).toHaveAttribute('data-heading', 'up');
  left.x -= 32;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [left, right],
  });
  await expect(
    page.getByTestId('custom-game-board-arena-rider-1')
  ).toHaveAttribute('data-heading', 'left');
  await expect(
    page.getByTestId('custom-game-board-arena-rider-0')
  ).toHaveAttribute('data-heading', 'right');
  await expect(arena).toHaveAttribute('data-trusted-touch-pointers', '2');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}
