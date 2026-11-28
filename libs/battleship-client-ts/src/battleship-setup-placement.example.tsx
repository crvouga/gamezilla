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
      `[data-testid="game-session-setup-${id}"]`
    );
    if (!element) throw new Error(`Missing setup ${id}`);
    return element.getBoundingClientRect();
  };
  for (const label of ['Ship to place']) {
    const control = root.querySelector<HTMLElement>(
      `button[aria-label^="${label}:"]`
    );
    if (!control) throw new Error(`Missing ${label}`);
    const bounds = control.getBoundingClientRect();
    // regression: battleship-round8-spatial-placement
    const text = control.querySelector<HTMLElement>('p');
    if (!text) throw new Error('Missing selected ship text');
    // regression: battleship-ship-picker-label-in-name
    await expect(control).toHaveAccessibleName(
      `Ship to place: ${text.textContent}`
    );
    await expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
    await expect(text.scrollHeight).toBeLessThanOrEqual(text.clientHeight);
    await expect(bounds.left).toBeGreaterThanOrEqual(0);
    await expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
    await expect(bounds.top).toBeGreaterThanOrEqual(0);
    await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  }
  const working = find('precision');
  const overview = find('grid');
  // regression: battleship-placement-overview-legibility
  // regression: battleship-round8-spatial-placement
  await expect(overview.width).toBe(224);
  await expect(overview.height).toBe(overview.width);
  await expect(overview.height).toBeLessThan(working.height);
  await expect(overview.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(overview.right).toBeLessThanOrEqual(window.innerWidth);
  await expect(working.width).toBeGreaterThanOrEqual(270);
  await expect(working.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(overview.top).toBeGreaterThanOrEqual(0);
  // regression: battleship-placement-guidance-gap
  const feedback =
    root.querySelector<HTMLElement>(
      '[data-component="BattleshipPlacementLayout"] [role="alert"]'
    ) ??
    root.querySelector<HTMLElement>(
      '[data-testid="game-session-setup-guidance"]'
    );
  if (!feedback) throw new Error('Missing placement guidance');
  await expect(
    working.top - feedback.getBoundingClientRect().bottom
  ).toBeLessThanOrEqual(8);
  // The space kept for a longer refusal sits above "Place in …", never
  // between the heading and its guidance (battleship-placement-heading-band).
  const heading = root.querySelector<HTMLElement>(
    '[data-testid="game-session-setup-region-heading"]'
  );
  if (!heading) throw new Error('Missing region heading');
  await expect(
    feedback.getBoundingClientRect().top -
      heading.getBoundingClientRect().bottom
  ).toBeLessThanOrEqual(8);
  await checkOverviewCoordinates(root);
  if (window.innerWidth >= 640) {
    await expect(overview.left).toBeGreaterThan(working.right);
    await expect(overview.bottom).toBe(working.bottom);
  } else {
    await expect(overview.bottom).toBeLessThanOrEqual(working.top);
    await expect(overview.width).toBeGreaterThanOrEqual(224);
  }
}

/** The overview's regions cover the same cells a player sees on the map. */
async function checkOverviewCoordinates(root: HTMLElement): Promise<void> {
  // regression: battleship-overview-detached-coordinates
  const canvas = within(root);
  const board = canvas.getByTestId('game-session-setup-grid');
  const columns = board.querySelectorAll<HTMLElement>('[data-corner="column"]');
  const rows = board.querySelectorAll<HTMLElement>('[data-corner="row"]');
  await expect(Array.from(columns, (label) => label.textContent).join('')).toBe(
    'ABCDEFGHIJ'
  );
  await expect(Array.from(rows, (label) => label.textContent).join(',')).toBe(
    '1,2,3,4,5,6,7,8,9,10'
  );
  for (const label of [...rows, ...columns]) {
    await expect(label.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      16
    );
    await expect(
      Number.parseFloat(getComputedStyle(label).fontSize)
    ).toBeGreaterThanOrEqual(12);
  }
  const region = canvas
    .getByTestId('game-session-setup-area-0')
    .getBoundingClientRect();
  const first = canvas
    .getByTestId('game-session-setup-cell-a1')
    .getBoundingClientRect();
  const last = canvas
    .getByTestId('game-session-setup-cell-e5')
    .getBoundingClientRect();
  for (const difference of [
    region.left - first.left,
    region.top - first.top,
    region.right - last.right,
    region.bottom - last.bottom,
  ]) {
    await expect(Math.abs(difference)).toBeLessThanOrEqual(1);
  }
}

/** Reposition the completed fleet through the same labeled selectors. */
export async function repositionEnlargedShip(
  canvasElement: HTMLElement
): Promise<void> {
  const canvas = within(canvasElement);
  const page = within(canvasElement.ownerDocument.body);
  await userEvent.click(
    canvas.getByRole('button', { name: /^Ship to place:/ })
  );
  await userEvent.click(
    await page.findByRole('option', { name: 'Destroyer · B2, across' })
  );
  await chooseSetupRegion(canvasElement, 'F–J / 6–10');
  const movedBow = await canvas.findByTestId(
    'game-session-setup-precision-cell-i7'
  );
  await checkSetupPlacementBounds(movedBow);
  await checkSetupWorkspace(canvasElement);
  await userEvent.click(movedBow);
  await expect(
    canvas.getByTestId('game-session-setup-cell-j7')
  ).toHaveAccessibleName('J7: Destroyer');
  await expect(
    canvas.getByTestId('game-session-setup-cell-b2')
  ).toHaveAccessibleName('B2: open water');
  await expect(
    canvas.getByTestId('game-session-setup-progress')
  ).toHaveTextContent('All five ships placed');
}

/** Check the literal overlap recovery before any click can scroll the controls. */
export async function checkSetupRecovery(
  root: HTMLElement,
  previousTop: number
): Promise<void> {
  // regression: battleship-placement-recovery-travel
  const canvas = within(root);
  const refusal = canvas
    .getByTestId('game-session-setup-refusal')
    .getBoundingClientRect();
  const rotate = canvas
    .getByTestId('game-session-setup-rotate')
    .getBoundingClientRect();
  const grid = canvas
    .getByTestId('game-session-setup-precision')
    .getBoundingClientRect();
  await expect(refusal.top).toBeGreaterThanOrEqual(0);
  await expect(refusal.bottom).toBeLessThanOrEqual(grid.top);
  await expect(rotate.bottom).toBeLessThanOrEqual(refusal.top);
  await expect(grid.top).toBe(previousTop);
  await expect(grid.bottom).toBeLessThanOrEqual(window.innerHeight);
  await checkSetupWorkspace(root);
}

/** A region switch never relies on click scrolling to reveal its control. */
export async function chooseSetupRegion(
  root: HTMLElement,
  region: string
): Promise<void> {
  const canvas = within(root);
  const control = canvas.getByRole('button', { name: region });
  const bounds = control.getBoundingClientRect();
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(bounds.width).toBeGreaterThanOrEqual(44);
  await expect(bounds.height).toBeGreaterThanOrEqual(44);
  await userEvent.click(control);
  await expect(control).toHaveAttribute('aria-pressed', 'true');
}
