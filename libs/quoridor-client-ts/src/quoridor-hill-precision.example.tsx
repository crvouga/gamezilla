import { expect, userEvent, within } from 'storybook/test';
import {
  chooseQuoridorCoordinate,
  expectQuoridorGoalMarker,
  expectQuoridorTargetVisible,
  expectQuoridorWorkingArea,
} from './quoridor-precision.example';

/** Full-size choices move all four pawns, then preview, cancel and place a wall. */
export async function playHillPreciseCoordinates(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await expectQuoridorWorkingArea(canvasElement);
  await expectQuoridorGoalMarker(canvasElement, 'e5');
  for (const [square, pawn] of [
    ['e2', 'South red circle'],
    ['a4', 'West gold diamond'],
    ['e8', 'North green triangle'],
    ['i6', 'East black square'],
  ] as const) {
    await expectQuoridorWorkingArea(canvasElement);
    await chooseQuoridorCoordinate(canvasElement, square);
    await expect(
      canvas.getByTestId(`custom-game-board-action-${square}`)
    ).toHaveAccessibleName(new RegExp(pawn));
  }
  await expectQuoridorWorkingArea(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
  await chooseQuoridorCoordinate(canvasElement, 'd4');
  const anchor = canvas.getByTestId('custom-game-board-action-d4h');
  await expect(anchor).toHaveAttribute('data-preview-edge-top', 'true');
  await expect(anchor).toHaveAttribute('data-edge-top', 'false');
  for (const id of ['wall-commit', 'wall-cancel'])
    await expectQuoridorTargetVisible(
      canvas.getByTestId(`custom-game-board-${id}`)
    );
  await userEvent.click(canvas.getByTestId('custom-game-board-wall-cancel'));
  await expect(anchor).toHaveAttribute('data-preview-edge-top', 'false');
  await expect(anchor).toHaveAttribute('data-edge-top', 'false');
  await chooseQuoridorCoordinate(canvasElement, 'd4');
  await expectQuoridorTargetVisible(
    canvas.getByTestId('custom-game-board-wall-commit')
  );
  await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
  await expect(canvas.getByTestId('custom-game-board-action-a3')).toBeEnabled();
  await expectQuoridorWorkingArea(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
  await expect(
    canvas.getByTestId('custom-game-board-action-d4h')
  ).toHaveAttribute('data-edge-top', 'true');
}
