import { expect } from 'storybook/test';

/** Assert before userEvent can scroll a clipped target into view. */
export async function checkSetupPlacementBounds(
  cell: HTMLElement
): Promise<void> {
  // regression: battleship-enlargement-below-fold
  const bounds = cell.getBoundingClientRect();
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(bounds.left).toBeGreaterThanOrEqual(0);
  await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  await expect(bounds.width).toBeGreaterThanOrEqual(44);
  await expect(bounds.width).toBeLessThanOrEqual(64);
  await expect(bounds.height).toBeGreaterThanOrEqual(44);
}
