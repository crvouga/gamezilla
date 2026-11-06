import { expect, userEvent, within } from 'storybook/test';
import {
  assertClear,
  checkInitialWordWorkspace,
} from './word-tiles-geometry.example';

async function assertFocusedCoordinates(
  canvasElement: HTMLElement,
  id: string
) {
  const cell = within(canvasElement).getByTestId(
    `custom-game-board-cell-${id}`
  );
  await expect(cell).toHaveFocus();
  const board = cell.closest('[data-component="WordTileBoard"]');
  const viewport = board?.parentElement;
  if (!board || !viewport) throw new Error('Missing word board viewport');
  const index = Number(cell.dataset['index']);
  const column = board.querySelectorAll('[data-axis="column"]')[index % 15];
  const row =
    board.querySelectorAll('[data-axis="row"]')[Math.floor(index / 15)];
  if (!column || !row) throw new Error('Missing focused coordinates');
  const bounds = cell.getBoundingClientRect();
  const clip = viewport.getBoundingClientRect();
  const top = column.getBoundingClientRect();
  const left = row.getBoundingClientRect();
  await expect(bounds.width).toBeGreaterThanOrEqual(44);
  await expect(bounds.height).toBeGreaterThanOrEqual(44);
  await expect(top.top).toBeGreaterThanOrEqual(clip.top);
  await expect(left.left).toBeGreaterThanOrEqual(clip.left);
  await expect(bounds.top).toBeGreaterThanOrEqual(top.bottom);
  await expect(bounds.left).toBeGreaterThanOrEqual(left.right);
  await expect(bounds.bottom).toBeLessThanOrEqual(clip.bottom);
  await expect(bounds.right).toBeLessThanOrEqual(clip.right);
  await expect(top.left).toBe(bounds.left);
  await expect(left.top).toBe(bounds.top);
  const overview = within(canvasElement).getByTestId(
    'custom-game-board-overview'
  );
  const context = overview.getBoundingClientRect();
  await expect(context.top).toBeGreaterThanOrEqual(clip.top);
  await expect(context.bottom).toBeLessThanOrEqual(clip.bottom);
  await expect(context.left).toBeGreaterThanOrEqual(clip.right);
}

/** Keyboard navigation must reveal its cell without concealing either coordinate. */
export async function checkEnlargedCoordinates(canvasElement: HTMLElement) {
  await checkInitialWordWorkspace(canvasElement);
  await userEvent.click(
    within(canvasElement).getByRole('button', { name: 'Enlarge board' })
  );
  // regression: word-tiles-enlarged-context-loss
  const canvas = within(canvasElement);
  const overview = canvas.getByTestId('custom-game-board-overview');
  await expect(overview).toBeVisible();
  await expect(overview.querySelectorAll('[data-state]')).toHaveLength(225);
  const indicator = overview.querySelector('[data-viewport-indicator]');
  await expect(indicator).not.toBeNull();
  await expect(
    canvas.getByRole('button', { name: 'Enlarge board' })
  ).toHaveAttribute('aria-pressed', 'true');
  await checkPrecisionWorkspace(canvasElement);
  await assertFocusedCoordinates(canvasElement, 'h8');
  for (const [keys, cell] of [
    ['{Control>}{Home}{/Control}', 'a1'],
    ['{End}', 'o1'],
    ['{Control>}{End}{/Control}', 'o15'],
    ['{Home}', 'a15'],
    ['{ArrowUp>7/}{ArrowRight>7/}', 'h8'],
  ] as const) {
    await userEvent.keyboard(keys);
    await assertFocusedCoordinates(canvasElement, cell);
  }
}

/** Literal 390×844 and 1440×900 placements must use the native available area. */
async function checkPrecisionWorkspace(
  canvasElement: HTMLElement
): Promise<void> {
  // regression: word-tiles-cramped-precision-window
  const canvas = within(canvasElement);
  const viewport = canvas.getByRole('region', {
    name: 'Scrollable word board',
  });
  const overview = canvas.getByTestId('custom-game-board-overview');
  const rect = viewport.getBoundingClientRect();
  const context = overview.getBoundingClientRect();
  const available = viewport.parentElement?.getBoundingClientRect();
  if (!available) throw new Error('Missing precision area');
  await expect(rect.width).toBeGreaterThanOrEqual(308);
  await expect(rect.width / available.width).toBeGreaterThanOrEqual(0.8);
  await expect(rect.height).toBeGreaterThanOrEqual(308);
  await expect(context.width / available.width).toBeLessThanOrEqual(0.2);
  await assertClear(viewport, false);
  await assertClear(overview);
  await assertClear(canvas.getByTestId('custom-game-board-rack'));
  await assertClear(canvas.getByTestId('custom-game-board-submit'));
}
