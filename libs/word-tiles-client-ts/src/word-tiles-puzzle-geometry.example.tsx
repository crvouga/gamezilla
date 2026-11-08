import { expect, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';

/** Native geometry before a locator click can scroll the context into view. */
export async function expectPuzzlePlacementContext(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  for (const id of [
    'word-tiles-puzzle-target',
    'word-tiles-puzzle-rack',
    'word-tiles-puzzle-bonus',
    'word-tiles-puzzle-submit',
  ]) {
    const bounds = canvas.getByTestId(id).getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThan(0);
    await expect(bounds.top).toBeGreaterThanOrEqual(0);
    await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    await expect(bounds.left).toBeGreaterThanOrEqual(0);
    await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  }
  const viewport = canvas.getByRole('region', {
    name: 'Scrollable word board',
  });
  await assertClear(viewport, false);
  const overview = canvas.queryByTestId('word-tiles-puzzle-overview');
  if (overview) {
    // regression: word-tiles-blank-chooser-pushes-precision-below-fold
    await assertClear(overview);
    const regions = canvas.getByRole('group', { name: 'View a board region' });
    for (const button of within(regions).getAllByRole('button'))
      await assertClear(button);
    await assertClear(canvas.getByRole('button', { name: 'Find a square' }));
  }
  const bounds = viewport.getBoundingClientRect();
  const rack = canvas
    .getByTestId('word-tiles-puzzle-rack')
    .getBoundingClientRect();
  await expect(bounds.top).toBeGreaterThanOrEqual(rack.bottom);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  // Seven 44px targets let the player read a rack-length placement at once.
  await expect(bounds.width).toBeGreaterThanOrEqual(7 * 44);
  await expect(bounds.height).toBeGreaterThanOrEqual(7 * 44);
}
