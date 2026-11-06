import { expect, userEvent, within } from 'storybook/test';

/** Assert before any input can scroll a clipped square into view. */
export async function assertPuzzleBounds(canvasElement: HTMLElement) {
  const cells = canvasElement.querySelectorAll<HTMLElement>(
    'button[data-square]'
  );
  await expect(cells.length).toBe(64);
  for (const cell of cells) {
    const bounds = cell.getBoundingClientRect();
    await expect(bounds.width).toBeGreaterThanOrEqual(32);
    await expect(bounds.height).toBeGreaterThanOrEqual(32);
    for (
      let parent = cell.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      const clip = parent.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(style.overflowY)) {
        await expect(bounds.top).toBeGreaterThanOrEqual(clip.top);
        await expect(bounds.bottom).toBeLessThanOrEqual(clip.bottom);
      }
      if (/hidden|clip|auto|scroll/.test(style.overflowX)) {
        await expect(bounds.left).toBeGreaterThanOrEqual(clip.left);
        await expect(bounds.right).toBeLessThanOrEqual(clip.right);
      }
    }
  }
  const frame = canvasElement.querySelector(
    '[data-component="ChessBoardFrame"]'
  );
  const layout = canvasElement.querySelector(
    '[data-component="ChessBoardLayout"]'
  );
  if (frame && layout) {
    await expect(frame.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      layout.getBoundingClientRect().bottom
    );
  }
}

// regression: chess-puzzle-guidance-clips-first-rank
export async function checkPuzzleFirstRank(canvasElement: HTMLElement) {
  await assertPuzzleBounds(canvasElement);
  const canvas = within(canvasElement);
  const king = canvas.getByRole('button', { name: /^e1, White king/ });
  await userEvent.click(king);
  await expect(king).toHaveAttribute('aria-pressed', 'true');
  await expect(
    canvas.getByRole('button', { name: /^f1, empty, Legal destination/ })
  ).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect(king).toHaveAttribute('aria-pressed', 'false');
}
