import { expect, userEvent, within } from 'storybook/test';
import { expectHillDestinationVisible } from './quoridor-hill-visibility.example';
import {
  chooseQuoridorCoordinate,
  expectQuoridorGoalMarker,
} from './quoridor-precision.example';
import {
  expectQuoridorSpatialArea,
  expectQuoridorWallPreview,
} from './quoridor-wall-preview.example';

/** Full-size choices move all four pawns, then preview, cancel and place a wall. */
export async function playHillPreciseCoordinates(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expectQuoridorSpatialArea(canvasElement);
  await expectQuoridorGoalMarker(canvasElement, 'e5');
  await expectHillDestinationVisible(canvasElement);
  for (const [square, pawn] of [
    ['e2', 'South red circle'],
    ['a4', 'West gold diamond'],
    ['e8', 'North green triangle'],
    ['i6', 'East black square'],
  ] as const) {
    await expectQuoridorSpatialArea(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    await chooseQuoridorCoordinate(canvasElement, square);
    await expect(
      canvas.getByTestId(`custom-game-board-action-${square}`)
    ).toHaveAccessibleName(new RegExp(pawn));
  }
  await playHillWallPreview(canvasElement);
}

/** Rotation preserves the full d4 proposal until cancellation or explicit commit. */
async function playHillWallPreview(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expectQuoridorSpatialArea(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
  await chooseQuoridorCoordinate(canvasElement, 'd4');
  const horizontal = canvas.getByTestId('custom-game-board-action-d4h');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.hover(horizontal);
  await userEvent.unhover(horizontal);
  await expect(horizontal).toHaveAttribute('data-preview-edge-top', 'true');
  await expect(horizontal).toHaveAttribute('data-edge-top', 'false');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-v'));
  const vertical = canvas.getByTestId('custom-game-board-action-d4v');
  await expect(vertical).toHaveAttribute('data-preview-edge-right', 'true');
  await expect(vertical).toHaveAttribute('data-edge-right', 'false');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-wall-cancel'));
  await expect(vertical).toHaveAttribute('data-preview-edge-right', 'false');
  await expect(vertical).toHaveAttribute('data-edge-right', 'false');
  await chooseQuoridorCoordinate(canvasElement, 'd4');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
  await expect(
    canvas.getByTestId('custom-game-board-action-d4h')
  ).toHaveAttribute('data-preview-edge-top', 'true');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
  await expect(canvas.getByTestId('custom-game-board-action-a3')).toBeEnabled();
  await expectQuoridorSpatialArea(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
  await expect(
    canvas.getByTestId('custom-game-board-action-d4h')
  ).toHaveAttribute('data-edge-top', 'true');
}
