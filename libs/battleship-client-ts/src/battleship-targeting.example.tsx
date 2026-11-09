import { expect, userEvent, within } from 'storybook/test';

/** Whether this screen aims through regions (a phone or tablet) or the whole board. */
export function hasWorkbench(root: HTMLElement): boolean {
  return (
    root.querySelector('[data-testid="custom-game-board-region"]') !== null
  );
}

/** Opens the region holding `cell` where aiming goes through regions. */
export async function showCell(root: HTMLElement, cell: string) {
  if (!hasWorkbench(root)) return;
  const area =
    Number(cell.charAt(0) >= 'f') +
    Math.floor((Number(cell.slice(1)) - 1) / 2) * 2;
  await userEvent.click(
    within(root).getByTestId(`custom-game-board-area-${area}`)
  );
}

/** The control that aims at `cell`: its enlarged cell, or the whole board's. */
export function aimCell(root: HTMLElement, cell: string): HTMLElement {
  return within(root).getByTestId(
    hasWorkbench(root)
      ? `custom-game-board-aim-${cell}`
      : `custom-game-board-target-${cell}`
  );
}

/** A wide screen aims at the whole board: it fits, with Fire under it. */
async function assertWholeBoardAim(root: HTMLElement, aimed: boolean) {
  // regression: battleship-desktop-aims-in-two-steps
  const canvas = within(root);
  const fire = canvas.getByTestId('custom-game-board-fire');
  const grid = canvas.getByTestId('custom-game-board-target-grid');
  await assertTargetViewport(root, [
    fire,
    grid,
    canvas.getByTestId('custom-game-seat-near'),
  ]);
  await expect(grid.closest('[inert]')).toBeNull();
  await expect(grid.querySelectorAll('[data-cell]')).toHaveLength(100);
  await expect(
    canvas.getByTestId('custom-game-board-target-j10').getBoundingClientRect()
      .width
  ).toBeGreaterThanOrEqual(32);
  await expect(grid.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    fire.getBoundingClientRect().top
  );
  if (aimed) {
    const cancel = canvas.getByTestId('custom-game-board-cancel-aim');
    await assertTargetViewport(root, [cancel]);
    await expect(fire).toHaveTextContent('Fire at J10');
  }
}

/** Measure before input, so userEvent cannot repair a clipped workspace by scrolling. */
export async function assertTargetWorkbench(root: HTMLElement, aimed = false) {
  if (!hasWorkbench(root)) return assertWholeBoardAim(root, aimed);
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
    canvas.getByTestId('custom-game-board-target-tools'),
    canvas.getByTestId('custom-game-seat-near'),
  ]);
  // regression: battleship-round8-spatial-target-context
  await expect(grid.getBoundingClientRect().width).toBe(
    grid.getBoundingClientRect().height
  );
  await expect(grid.closest('[inert]')).not.toBeNull();
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
