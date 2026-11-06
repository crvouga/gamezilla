import { expect, userEvent, within } from 'storybook/test';
import {
  assertPuzzleBounds,
  checkPuzzleFirstRank,
} from './chess-puzzle-bounds.checks';

/** Keyboard moves exercise the board's real selection and action emission. */
export async function completeChessPuzzle(canvasElement: HTMLElement) {
  await checkPuzzleFirstRank(canvasElement);
  const canvas = within(canvasElement);
  const move = async (name: RegExp, keys: string) => {
    canvas.getByRole('button', { name }).focus();
    await userEvent.keyboard(`{Enter}${keys}{Enter}`);
  };
  await move(/^f3, White knight/, '{ArrowUp}{ArrowUp}{ArrowLeft}');
  await expect(
    canvas.getByRole('button', { name: /^d1, Black bishop/ })
  ).toBeVisible();
  await move(
    /^c4, White bishop/,
    '{ArrowUp}{ArrowUp}{ArrowUp}{ArrowRight}{ArrowRight}{ArrowRight}'
  );
  await expect(
    canvas.getByRole('button', { name: /^e7, Black king/ })
  ).toBeVisible();
  await move(/^c3, White knight/, '{ArrowUp}{ArrowUp}{ArrowRight}');
  await expect(canvas.getByText('Checkmate. Puzzle solved.')).toBeVisible();
  await expect(
    canvas.getByRole('button', { name: /^d5, White knight/ })
  ).toBeVisible();
}

export async function recoverChessPuzzle(canvasElement: HTMLElement) {
  await checkPuzzleFirstRank(canvasElement);
  const canvas = within(canvasElement);
  canvas.getByRole('button', { name: /^c3, White knight/ }).focus();
  await userEvent.keyboard('{Enter}{ArrowUp}{ArrowUp}{ArrowRight}{Enter}');
  await expect(
    canvas.getByText(
      'That knight move misses the tactic. Retry from the same position.'
    )
  ).toBeVisible();
  await expect(
    canvas.getByRole('button', { name: /^d5, White knight/ })
  ).toBeVisible();
  await userEvent.click(canvas.getByRole('button', { name: /Retry/i }));
  await expect(
    canvas.getByRole('button', { name: /^c3, White knight/ })
  ).toBeVisible();
  await assertPuzzleBounds(canvasElement);
  await userEvent.click(canvas.getByRole('button', { name: /^Hint$/i }));
  await assertPuzzleBounds(canvasElement);
  await expect(
    canvas.getByRole('button', {
      name: /f3, White knight, Hint: move this piece/,
    })
  ).toBeVisible();
  await completeChessPuzzle(canvasElement);
}
