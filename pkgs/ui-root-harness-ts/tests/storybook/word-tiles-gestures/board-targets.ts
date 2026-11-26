import { expect, type Locator, type Page } from '@playwright/test';

export async function point(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error('Missing board target');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
export const centerCell = (page: Page) =>
  page.getByTestId('custom-game-board-cell-h8');
export const rackTile = (page: Page) =>
  page.getByTestId('custom-game-board-rack-11');
export const viewport = (page: Page) =>
  page.getByRole('region', { name: 'Scrollable word board' });

export async function squareAt(page: Page, p: { x: number; y: number }) {
  return page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-cell]')
        ?.getAttribute('data-cell'),
    p
  );
}
export async function assertPlacement(page: Page) {
  await expect(centerCell(page)).toHaveAccessibleName(
    'C 3, h8, your tentative tile'
  );
  await expect(rackTile(page)).toHaveAttribute('data-placed', 'true');
  await expect(page.locator('[data-state="committed"][data-cell]')).toHaveCount(
    0
  );
}
