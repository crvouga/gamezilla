import { expect, userEvent, within } from 'storybook/test';

/** Keyboard proposal cancellation uses the same board for both game variants. */
export async function cancelQuoridorWallWithKeyboard(
  canvasElement: HTMLElement
) {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
  const anchor = canvas.getByTestId('custom-game-board-action-d4h');
  anchor.focus();
  await userEvent.keyboard('{Enter}');
  await expect(
    canvas.getByTestId('custom-game-board-wall-commit')
  ).toBeEnabled();
  await expect(anchor).toHaveAttribute('data-preview-edge-top', 'true');
  // regression: quoridor-escape-preview-cancel
  await userEvent.keyboard('{Escape}');
  await expect(
    canvas.queryByTestId('custom-game-board-wall-commit')
  ).not.toBeInTheDocument();
  await expect(anchor).toHaveAttribute('data-preview-edge-top', 'false');
  await expect(anchor).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  await expect(
    canvas.getByTestId('custom-game-board-wall-commit')
  ).toBeEnabled();
  await userEvent.click(canvas.getByTestId('custom-game-board-mode-v'));
  await expect(
    canvas.getByTestId('custom-game-board-action-d4v')
  ).toHaveAttribute('data-preview-edge-right', 'true');
  await userEvent.click(canvas.getByTestId('custom-game-board-wall-cancel'));
  await expect(
    canvas.queryByTestId('custom-game-board-wall-commit')
  ).not.toBeInTheDocument();
}
