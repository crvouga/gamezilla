import { expect, userEvent, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';

/** The small map is a locator: inspect the full board and return without placing. */
export async function expectBoardMap(
  canvasElement: HTMLElement,
  testId: string
) {
  // regression: word-tiles-overview-unreadable-context
  const canvas = within(canvasElement);
  const trigger = canvas.getByRole('button', {
    name: 'Board map: locate a square',
  });
  await assertClear(trigger);
  const original = canvas.getByTestId(`${testId}-cell-h8`);
  const state = original.getAttribute('data-state');
  await userEvent.click(trigger);
  const page = within(canvasElement.ownerDocument.body);
  const map = page.getByTestId(`${testId}-map`);
  // Native bounds before clicking can scroll the map or its enclosing dialog.
  const viewport = map.parentElement;
  if (!viewport) throw new Error('Missing map viewport');
  await assertClear(viewport);
  await expect(map.getBoundingClientRect().width).toBeGreaterThanOrEqual(280);
  await expect(map.querySelectorAll('[data-cell]')).toHaveLength(225);
  const intersection = page.getByTestId(`${testId}-map-cell-h8`);
  await expect(intersection).toHaveTextContent(original.textContent);
  await userEvent.click(intersection);
  await expect(original).toHaveFocus();
  await expect(original).toHaveAttribute('data-state', state ?? 'empty');
  await expect(page.queryByRole('dialog')).not.toBeInTheDocument();
  await assertClear(original);
  await userEvent.click(trigger);
  await userEvent.keyboard('{Escape}');
  await expect(trigger).toHaveFocus();
}
