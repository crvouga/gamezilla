import { expect, within } from 'storybook/test';

/** Measure before input, so userEvent cannot repair a clipped workspace by scrolling. */
export async function assertTargetWorkbench(root: HTMLElement, aimed = false) {
  // regression: battleship-default-precision-loses-whole-field
  // regression: battleship-target-confirmation-competes-with-navigation
  // regression: battleship-target-context-below-fold
  const canvas = within(root);
  const fire = canvas.getByTestId('custom-game-board-fire');
  const grid = canvas.getByTestId('custom-game-board-target-grid');
  const aim = canvas.getByTestId('custom-game-board-aim-grid');
  const region = canvas.getByTestId('custom-game-board-region');
  await assertTargetViewport(root, [
    fire,
    grid,
    aim,
    region,
    canvas.getByTestId('custom-game-board-large-targets'),
    canvas.getByTestId('custom-game-seat-near'),
  ]);
  await expect(grid.querySelectorAll('[data-cell]')).toHaveLength(100);
  for (const cell of [
    ...aim.querySelectorAll<HTMLElement>('[data-cell]'),
    ...region.querySelectorAll<HTMLElement>('button'),
  ]) {
    await assertTargetViewport(root, [cell]);
    await expect(cell.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    await expect(cell.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44
    );
  }
  await expect(aim.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    fire.getBoundingClientRect().top
  );
  if (aimed) {
    const cancel = canvas.getByTestId('custom-game-board-cancel-aim');
    await assertTargetViewport(root, [cancel]);
    await expect(cancel).toHaveAttribute('data-face', 'neutral-ghost');
    await expect(fire).toHaveAttribute('data-face', 'primary');
    await expect(fire).toHaveTextContent('Fire at J10');
    await expect(cancel.getBoundingClientRect().top).toBe(
      fire.getBoundingClientRect().top
    );
  }
}

/** Bounds must pass on the untouched viewport, including the local turn context. */
export async function assertTargetViewport(
  root: HTMLElement,
  elements: HTMLElement[]
) {
  const viewport = root.ownerDocument.defaultView;
  if (viewport === null)
    throw new Error('Target board requires a browser viewport');
  for (const element of elements) {
    const bounds = element.getBoundingClientRect();
    await expect(bounds.left).toBeGreaterThanOrEqual(0);
    await expect(bounds.top).toBeGreaterThanOrEqual(0);
    await expect(bounds.right).toBeLessThanOrEqual(viewport.innerWidth);
    await expect(bounds.bottom).toBeLessThanOrEqual(viewport.innerHeight);
  }
}
