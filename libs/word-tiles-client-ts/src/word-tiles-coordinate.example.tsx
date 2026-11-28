import { expect, userEvent, within } from 'storybook/test';
import {
  assertClear,
  checkInitialWordWorkspace,
} from './word-tiles-geometry.example';
import { expectBoardMap } from './word-tiles-map.example';
import { viewPrecisionRegion } from './word-tiles-precision.example';
import {
  boardViewButton,
  boardViewTools,
  closeBoardView,
  enlargeBoard,
} from './word-tiles-view.example';

/**
 * What sits under the enlarged board: its overview on a wide screen, or the
 * Board tools button a phone keeps it behind.
 */
function underBoard(canvasElement: HTMLElement): HTMLElement {
  return (
    within(canvasElement).queryByTestId('game-session-board-overview') ??
    within(canvasElement).getByRole('button', {
      name: 'Board tools: zoom and find a square',
    })
  );
}

async function assertFocusedCoordinates(
  canvasElement: HTMLElement,
  id: string
) {
  const cell = within(canvasElement).getByTestId(
    `game-session-board-cell-${id}`
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
  // The overview stays clear of the window: under it and within its width
  // (a phone, a narrow column), or beside it and within its height (a wide
  // column, where it stands under Fit and Enlarge so the window keeps its
  // rows). Either way it never covers a square and stays in view.
  const context = underBoard(canvasElement).getBoundingClientRect();
  await expect(context.bottom).toBeLessThanOrEqual(window.innerHeight);
  if (context.left >= clip.right) {
    await expect(context.top).toBeGreaterThanOrEqual(clip.top);
    await expect(context.bottom).toBeLessThanOrEqual(clip.bottom);
  } else {
    await expect(context.top).toBeGreaterThanOrEqual(clip.bottom);
    await expect(context.left).toBeGreaterThanOrEqual(clip.left);
    await expect(context.right).toBeLessThanOrEqual(clip.right);
  }
}

/** Keyboard navigation must reveal its cell without concealing either coordinate. */
export async function checkEnlargedCoordinates(canvasElement: HTMLElement) {
  await checkInitialWordWorkspace(canvasElement);
  await enlargeBoard(canvasElement);
  // regression: word-tiles-enlarged-context-loss
  const canvas = within(canvasElement);
  const tools = await boardViewTools(canvasElement);
  const overview = tools.getByTestId('game-session-board-overview');
  await expect(overview).toBeVisible();
  await assertClear(overview);
  await expect(overview.getBoundingClientRect().width).toBeGreaterThanOrEqual(
    132
  );
  await expect(overview.querySelectorAll('[data-state]')).toHaveLength(225);
  const indicator = overview.querySelector('[data-viewport-indicator]');
  await expect(indicator).not.toBeNull();
  await expect(
    tools.getByRole('button', { name: 'Enlarge board' })
  ).toHaveAttribute('aria-pressed', 'true');
  await closeBoardView(canvasElement);
  await checkPrecisionWorkspace(canvasElement);
  canvas
    .getByTestId('game-session-board-cell-h8')
    .focus({ preventScroll: true });
  await assertFocusedCoordinates(canvasElement, 'h8');
  await viewPrecisionRegion(canvasElement, 'View a1 to e5');
  await assertFocusedCoordinates(canvasElement, 'c3');
  await viewPrecisionRegion(canvasElement, 'View f6 to j10');
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
  await expectBoardMap(canvasElement, 'game-session-board');
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
  const rect = viewport.getBoundingClientRect();
  const available = viewport.parentElement?.getBoundingClientRect();
  if (!available) throw new Error('Missing precision area');
  await expect(rect.width).toBeGreaterThanOrEqual(308);
  await expect(rect.width / available.width).toBeGreaterThanOrEqual(0.8);
  await expect(rect.height).toBeGreaterThanOrEqual(308);
  await assertClear(viewport, false);
  await assertClear(underBoard(canvasElement));
  // A phone's Board tools button stands for its overview, checked in its dialog.
  if (!boardViewButton(canvasElement))
    await expect(
      underBoard(canvasElement).getBoundingClientRect().width
    ).toBeGreaterThanOrEqual(132);
  await assertClear(canvas.getByTestId('game-session-board-rack'));
  await assertClear(canvas.getByTestId('game-session-board-submit'));
}
