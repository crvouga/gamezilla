import { expect, userEvent, within } from 'storybook/test';

/** Assert before userEvent can scroll a clipped target into view. */
export async function checkSetupPlacementBounds(
  cell: HTMLElement
): Promise<void> {
  // regression: battleship-enlargement-below-fold
  const bounds = cell.getBoundingClientRect();
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(bounds.left).toBeGreaterThanOrEqual(0);
  await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  await expect(bounds.width).toBeGreaterThanOrEqual(44);
  await expect(bounds.width).toBeLessThanOrEqual(64);
  await expect(bounds.height).toBeGreaterThanOrEqual(44);
}

/** Literal 390×844 / 1440×844 enlarged setup, before any target scroll. */
export async function checkSetupWorkspace(root: HTMLElement): Promise<void> {
  // regression: battleship-placement-detached-overview
  const find = (id: string) => {
    const element = root.querySelector<HTMLElement>(
      `[data-testid="custom-game-setup-${id}"]`
    );
    if (!element) throw new Error(`Missing setup ${id}`);
    return element.getBoundingClientRect();
  };
  for (const label of ['Ship to place', 'Placement area']) {
    const control = root.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    if (!control) throw new Error(`Missing ${label}`);
    const bounds = control.getBoundingClientRect();
    await expect(bounds.width).toBeLessThanOrEqual(272);
    await expect(bounds.top).toBeGreaterThanOrEqual(0);
    await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  }
  const working = find('precision');
  const overview = find('grid');
  await expect(overview.width).toBeLessThanOrEqual(176);
  await expect(overview.height).toBeLessThan(working.height);
  await expect(overview.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(overview.right).toBeLessThanOrEqual(window.innerWidth);
  await expect(working.width).toBeGreaterThanOrEqual(270);
  if (window.innerWidth >= 640) {
    await expect(overview.left).toBeGreaterThan(working.right);
    await expect(overview.bottom).toBe(working.bottom);
  } else {
    await expect(overview.top - working.bottom).toBeLessThanOrEqual(48);
  }
}

/** Reposition the completed fleet through the same labeled selectors. */
export async function repositionEnlargedShip(
  canvasElement: HTMLElement
): Promise<void> {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('button', { name: 'Ship to place' }));
  await userEvent.click(
    await page.findByRole('option', { name: 'Destroyer · B2, across' })
  );
  await userEvent.click(canvas.getByRole('button', { name: 'Placement area' }));
  await userEvent.click(
    await page.findByRole('option', { name: 'F–J / 6–10' })
  );
  const movedBow = await canvas.findByTestId(
    'custom-game-setup-precision-cell-i7'
  );
  await checkSetupPlacementBounds(movedBow);
  await checkSetupWorkspace(canvasElement);
  await userEvent.click(movedBow);
  await expect(
    canvas.getByTestId('custom-game-setup-cell-j7')
  ).toHaveAccessibleName('J7: Destroyer');
  await expect(
    canvas.getByTestId('custom-game-setup-cell-b2')
  ).toHaveAccessibleName('B2: open water');
  await expect(
    canvas.getByTestId('custom-game-setup-progress')
  ).toHaveTextContent('All five ships placed');
}
