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

/** Full-size choices move all four pawns in turn. */
export async function playHillPreciseCoordinates(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-coordinates'));
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
      canvas.getByTestId(`game-session-board-action-${square}`)
    ).toHaveAccessibleName(new RegExp(pawn));
  }
}

/**
 * Rotation preserves the full d4 proposal until cancellation or explicit commit.
 * A separate journey from the pawn moves so each fits the story deadline on a throttled phone.
 */
export async function playHillWallPreview(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-coordinates'));
  await expectQuoridorSpatialArea(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-mode-h'));
  await expectQuoridorSpatialArea(canvasElement);
  await chooseQuoridorCoordinate(canvasElement, 'd4');
  const horizontal = canvas.getByTestId('game-session-board-action-d4h');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.hover(horizontal);
  await userEvent.unhover(horizontal);
  await expect(horizontal).toHaveAttribute('data-preview-edge-top', 'true');
  await expect(horizontal).toHaveAttribute('data-edge-top', 'false');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-mode-v'));
  const vertical = canvas.getByTestId('game-session-board-action-d4v');
  await expect(vertical).toHaveAttribute('data-preview-edge-right', 'true');
  await expect(vertical).toHaveAttribute('data-edge-right', 'false');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-wall-cancel'));
  await expect(vertical).toHaveAttribute('data-preview-edge-right', 'false');
  await expect(vertical).toHaveAttribute('data-edge-right', 'false');
  await chooseQuoridorCoordinate(canvasElement, 'd4');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-mode-h'));
  await expect(
    canvas.getByTestId('game-session-board-action-d4h')
  ).toHaveAttribute('data-preview-edge-top', 'true');
  await expectQuoridorWallPreview(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-wall-commit'));
  await expect(
    canvas.getByTestId('game-session-board-action-a3')
  ).toBeEnabled();
  await expectQuoridorSpatialArea(canvasElement);
  await userEvent.click(canvas.getByTestId('game-session-board-mode-h'));
  await expect(
    canvas.getByTestId('game-session-board-action-d4h')
  ).toHaveAttribute('data-edge-top', 'true');
}
