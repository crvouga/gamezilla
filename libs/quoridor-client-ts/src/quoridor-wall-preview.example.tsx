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

/**
 * A legal proposal is four solid accent edges. A refused one is only its
 * dashed edges that do not sit on an existing wall, and every committed
 * wall stays drawn solid, so the cause of the refusal remains visible.
 */
// regression: quoridor-refused-wall-hides-its-cause
export async function expectQuoridorWallPreview(
  canvasElement: HTMLElement,
  options: { readonly refused?: boolean } = {}
) {
  const canvas = within(canvasElement);
  const view = canvasElement.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  await expectQuoridorSpatialArea(canvasElement);
  for (const id of ['wall-commit', 'wall-cancel'])
    await expectQuoridorTargetVisible(
      canvas.getByTestId(`custom-game-board-${id}`)
    );
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const marked = (kind: 'edge' | 'preview-edge') =>
    [
      ...canvasElement.querySelectorAll(
        '[data-testid^="custom-game-board-action-"]'
      ),
    ].flatMap((cell) =>
      sides
        .filter((side) => cell.getAttribute(`data-${kind}-${side}`) === 'true')
        .map((side) => ({ cell, side }))
    );
  const previews = marked('preview-edge');
  if (options.refused === true)
    await expect(previews.length).toBeLessThanOrEqual(4);
  else await expect(previews.length).toBe(4);
  for (const { cell, side } of previews) {
    await expect(
      view.getComputedStyle(cell).getPropertyValue(`border-${side}-style`)
    ).toBe(options.refused === true ? 'dashed' : 'solid');
    await expect(cell.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      view.innerWidth >= 1000 ? 44 : 32
    );
  }
  for (const { cell, side } of marked('edge'))
    await expect(
      view.getComputedStyle(cell).getPropertyValue(`border-${side}-style`)
    ).toBe('solid');
}
