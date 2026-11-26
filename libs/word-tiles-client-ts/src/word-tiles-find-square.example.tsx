import { expect, userEvent, waitFor, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';
import { boardViewButton, boardViewTools } from './word-tiles-view.example';

/** Opens Board tools, then Find a square, and chooses `id` on its map. */
async function findSquare(
  canvasElement: HTMLElement,
  testId: string,
  id: string
): Promise<HTMLElement> {
  const tools = await boardViewTools(canvasElement);
  await userEvent.click(tools.getByRole('button', { name: 'Find a square' }));
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(page.getByTestId(`${testId}-map-cell-${id}`));
  const cell = within(canvasElement).getByTestId(`${testId}-cell-${id}`);
  await expect(cell).toHaveFocus();
  await expect(page.queryByRole('dialog')).not.toBeInTheDocument();
  return cell;
}

/** The enlarged window holds whole squares, its scroll resting on a square's edge. */
async function expectWholeSquares(cell: HTMLElement): Promise<void> {
  // regression: word-tiles-enlarged-edge-slivers
  const board = cell.closest<HTMLElement>('[data-component="WordTileBoard"]');
  const viewport = board?.parentElement;
  const row = board?.querySelector('[data-axis="row"]');
  const column = board?.querySelector('[data-axis="column"]');
  if (!viewport || !row || !column) throw new Error('Missing board window');
  const pitch = cell.getBoundingClientRect().width + 1;
  const across = viewport.clientWidth - row.getBoundingClientRect().width;
  const down = viewport.clientHeight - column.getBoundingClientRect().height;
  await expect(Math.abs(across - Math.round(across / pitch) * pitch)).toBe(0);
  await expect(Math.abs(down - Math.round(down / pitch) * pitch)).toBe(0);
  await waitFor(async () => {
    await expect(viewport.scrollLeft % pitch).toBe(0);
    await expect(viewport.scrollTop % pitch).toBe(0);
  });
}

/**
 * A phone's whole journey to a distant square and back: Board tools, Find
 * a square, a corner off screen, back to the centre star, then a tile
 * placed there. A wide screen, without Board tools, has nothing to check.
 */
export async function findAndPlace(
  canvasElement: HTMLElement,
  testId: string
): Promise<void> {
  if (!boardViewButton(canvasElement)) return;
  const canvas = within(canvasElement);
  const corner = canvas.getByTestId(`${testId}-cell-a1`);
  const viewport = corner.closest(
    '[data-component="WordTileBoard"]'
  )?.parentElement;
  if (!viewport) throw new Error('Missing board window');
  // The corner starts outside the window around the centre star.
  await expect(
    corner.getBoundingClientRect().right <=
      viewport.getBoundingClientRect().left + 1
  ).toBe(true);
  await assertClear(await findSquare(canvasElement, testId, 'a1'));
  await expectWholeSquares(corner);
  const star = await findSquare(canvasElement, testId, 'h8');
  await assertClear(star);
  await expectWholeSquares(star);
  await userEvent.click(canvas.getByTestId(`${testId}-rack-11`));
  await userEvent.click(star);
  await expect(star).toHaveAttribute('data-state', 'tentative');
  await userEvent.click(star);
  await expect(star).toHaveAttribute('data-state', 'empty');
}
