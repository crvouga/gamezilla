import { expect, userEvent, within } from 'storybook/test';

/** Geometry is sampled before any input can scroll a control into view. */
export async function expectQuoridorWorkingArea(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const board = await canvas.findByTestId('custom-game-board');
  const tools = canvas.getByTestId('custom-game-board-tools');
  const picker = canvas.getByTestId('custom-game-board-precise-target');
  const boardRect = board.getBoundingClientRect();
  await expect(tools.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    boardRect.bottom
  );
  await expect(
    tools.getBoundingClientRect().top - boardRect.bottom
  ).toBeLessThanOrEqual(8);
  await expect(
    picker.getBoundingClientRect().top - tools.getBoundingClientRect().bottom
  ).toBeLessThanOrEqual(44);
  for (const element of [board, picker, ...tools.querySelectorAll('button')])
    await expectQuoridorTargetVisible(element);
}

export async function expectQuoridorTargetVisible(element: Element) {
  const view = element.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  const rect = element.getBoundingClientRect();
  const failures: string[] = [];
  if (rect.width < 44 || rect.height < 44)
    failures.push('target smaller than 44px');
  if (
    rect.left < 0 ||
    rect.top < 0 ||
    rect.right > view.innerWidth ||
    rect.bottom > view.innerHeight
  )
    failures.push('outside initial viewport');
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const style = view.getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (
      style.overflowX !== 'visible' &&
      (rect.left < bounds.left || rect.right > bounds.right)
    )
      failures.push('horizontally clipped');
    if (
      style.overflowY !== 'visible' &&
      (rect.top < bounds.top || rect.bottom > bounds.bottom)
    )
      failures.push('vertically clipped');
  }
  await expect(
    failures,
    element.getAttribute('data-testid') ?? element.tagName
  ).toEqual([]);
}

/** Uses the production picker and asserts its actual option size before selection. */
export async function chooseQuoridorCoordinate(
  canvasElement: HTMLElement,
  coordinate: string
) {
  const canvas = within(canvasElement);
  await expectQuoridorWorkingArea(canvasElement);
  await userEvent.click(canvas.getByTestId('custom-game-board-precise-target'));
  const document = within(canvasElement.ownerDocument.body);
  const search = document.queryByRole('searchbox');
  if (search) await userEvent.type(search, coordinate);
  const option = await document.findByTestId(
    `custom-game-board-precise-${coordinate}`
  );
  await expectQuoridorTargetVisible(option);
  await userEvent.click(option);
}

/** Goals use small corner diamonds; only physical walls use straight edges. */
export async function expectQuoridorGoalMarker(
  canvasElement: HTMLElement,
  cell: string
) {
  const goal = within(canvasElement).getByTestId(
    `custom-game-board-action-${cell}`
  );
  const view = goal.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  await expect(goal).toHaveAttribute('data-goal', 'true');
  await expect(goal).toHaveAttribute('data-outlined', 'false');
  await expect(view.getComputedStyle(goal).boxShadow).toBe('none');
  const marker = view.getComputedStyle(goal, '::before');
  await expect(marker.borderTopStyle).toBe('none');
  await expect(parseFloat(marker.width)).toBe(4);
  await expect(parseFloat(marker.height)).toBe(4);
  await expect(luminance(marker.backgroundColor)).toBeLessThan(
    luminance(view.getComputedStyle(goal).backgroundColor)
  );
}

/** Literal opening cells: a8 is quiet, e2 is legal, a9 names the goal. */
// regression: quoridor-competing-cell-chrome
export async function expectQuoridorCellHierarchy(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const quiet = canvas.getByTestId('custom-game-board-action-a8');
  const legal = canvas.getByTestId('custom-game-board-action-e2');
  const view = quiet.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  const style = view.getComputedStyle(quiet);
  await expect(style.borderRadius).toBe('0px');
  await expect(style.borderTopWidth).toBe('1px');
  const luminances = [style.borderTopColor, style.backgroundColor].map(
    luminance
  );
  const contrast =
    (Math.max(...luminances) + 0.05) / (Math.min(...luminances) + 0.05);
  await expect(contrast).toBeGreaterThanOrEqual(3);
  await expect(legal).toHaveTextContent('○');
  const glyph = legal.querySelector('span');
  if (!glyph) throw new Error('Legal destination glyph missing');
  await expect(
    parseFloat(view.getComputedStyle(glyph).fontSize)
  ).toBeGreaterThan(legal.getBoundingClientRect().width * 0.6);
  await expectQuoridorGoalMarker(canvasElement, 'a9');
}

/**
 * On tablet and desktop the board is centred in its column and uses the
 * room the first view allows; phones keep their own measure.
 */
// regression: quoridor-tablet-board-undersized
export async function expectQuoridorBoardUsesColumn(
  canvasElement: HTMLElement
) {
  const view = canvasElement.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  if (view.innerWidth < 700 || view.innerHeight < 1000) return;
  const canvas = within(canvasElement);
  const board = canvas.getByTestId('custom-game-board').getBoundingClientRect();
  const column = canvas
    .getByTestId('custom-game-board-tools')
    .parentElement?.getBoundingClientRect();
  if (!column) throw new Error('The board column is missing');
  await expect(board.width).toBeGreaterThanOrEqual(440);
  await expect(
    Math.abs(board.left - column.left - (column.right - board.right))
  ).toBeLessThanOrEqual(2);
}

/** Each pawn's ink stays readable against its own square in every app theme. */
// regression: quoridor-pawn-ink-vanishes-in-dark-theme
export async function expectQuoridorPawnInk(
  canvasElement: HTMLElement,
  cells: readonly string[]
) {
  const view = canvasElement.ownerDocument.defaultView;
  if (!view) throw new Error('The story requires a browser window');
  for (const cell of cells) {
    const pawn = within(canvasElement).getByTestId(
      `custom-game-board-action-${cell}`
    );
    // The first painted ancestor is the square behind the glyph.
    let ground: Element | null = pawn;
    let background = '';
    while (ground && (background === '' || background.endsWith(', 0)'))) {
      background = view.getComputedStyle(ground).backgroundColor;
      ground = ground.parentElement;
    }
    const inks = [view.getComputedStyle(pawn).color, background].map(luminance);
    const contrast = (Math.max(...inks) + 0.05) / (Math.min(...inks) + 0.05);
    await expect(contrast, `${cell} pawn ink contrast`).toBeGreaterThanOrEqual(
      4.5
    );
  }
}

function luminance(color: string): number {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (channels?.length !== 3) throw new Error(`Unresolved color: ${color}`);
  return channels.reduce((sum, channel, index) => {
    const value = channel / 255;
    const linear =
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
  }, 0);
}
