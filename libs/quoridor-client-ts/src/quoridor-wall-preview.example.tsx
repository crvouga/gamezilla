import { expect, within } from 'storybook/test';
import {
  expectQuoridorTargetVisible,
  expectQuoridorWorkingArea,
} from './quoridor-precision.example';

/** Check native geometry before an input can scroll the board or its controls. */
export async function expectQuoridorSpatialArea(canvasElement: HTMLElement) {
  await expectQuoridorWorkingArea(canvasElement);
  const canvas = within(canvasElement);
  const board = canvas.getByTestId('custom-game-board');
  const view = canvasElement.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  const minimum =
    view.innerWidth >= 1000 ? 440 : Math.min(view.innerWidth - 32, 364);
  await expect(board.getBoundingClientRect().width).toBeGreaterThanOrEqual(
    minimum
  );
  for (const name of ['Horizontal wall', 'Vertical wall'])
    await expect(canvas.getByRole('button', { name })).toHaveTextContent(name);
}

/** A complete wall remains painted while confirmation is reachable without scrolling. */
export async function expectQuoridorWallPreview(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expectQuoridorSpatialArea(canvasElement);
  for (const id of ['wall-commit', 'wall-cancel'])
    await expectQuoridorTargetVisible(
      canvas.getByTestId(`custom-game-board-${id}`)
    );
  const edges = canvasElement.querySelectorAll(
    '[data-preview-edge-top="true"], [data-preview-edge-right="true"], [data-preview-edge-bottom="true"], [data-preview-edge-left="true"]'
  );
  await expect(edges.length).toBe(4);
  for (const cell of edges) {
    const view = cell.ownerDocument.defaultView;
    if (!view) throw new Error('The story requires a browser window');
    const edge = ['top', 'right', 'bottom', 'left'].find(
      (side) => cell.getAttribute(`data-preview-edge-${side}`) === 'true'
    );
    await expect(
      view.getComputedStyle(cell).getPropertyValue(`border-${edge}-style`)
    ).toBe('solid');
    await expect(cell.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      view.innerWidth >= 1000 ? 44 : 32
    );
  }
}
