import { expect, within } from 'storybook/test';

/** Measure the untouched viewport before a pointer action can scroll its target. */
export async function assertTargetWorkbench(root: HTMLElement, aimed = false) {
  // regression: battleship-target-confirmation-competes-with-navigation
  const canvas = within(root);
  const fire = canvas.getByTestId('custom-game-board-fire');
  const tools = canvas.getByTestId('custom-game-board-target-tools');
  const view = canvas.getByTestId('custom-game-board-large-targets');
  const region = canvas.getByTestId('custom-game-board-region');
  const grid = canvas.getByTestId('custom-game-board-target-grid');
  await assertTargetViewport(root, [fire, view, region, grid]);
  await expect(view.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  await expect(region.getBoundingClientRect().height).toBeGreaterThanOrEqual(
    44
  );
  await expect(view.getBoundingClientRect().top).toBe(
    region.getBoundingClientRect().top
  );
  await expect(tools.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    fire.getBoundingClientRect().bottom
  );
  await expect(view).toHaveAttribute('data-face', 'neutral-outline');
  if (aimed) {
    const cancel = canvas.getByTestId('custom-game-board-cancel-aim');
    await expect(cancel).toHaveAttribute('data-face', 'neutral-ghost');
    await expect(fire).toHaveAttribute('data-face', 'primary');
    await expect(fire).toHaveTextContent('Fire at J10');
    await expect(cancel.getBoundingClientRect().top).toBe(
      fire.getBoundingClientRect().top
    );
    await expect(cancel.getBoundingClientRect().right).toBeLessThanOrEqual(
      fire.getBoundingClientRect().left
    );
    await expect(cancel.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44
    );
  }
}

/** Shared by the initial whole-board state and the enlarged state, before input. */
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
