import { expect, userEvent, within } from 'storybook/test';

/** Geometry is sampled before any input can scroll a control into view. */
export async function expectQuoridorWorkingArea(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const board = await canvas.findByTestId('custom-game-board');
  const tools = canvas.getByTestId('custom-game-board-tools');
  const picker = canvas.getByTestId('custom-game-board-precise-target');
  const boardRect = board.getBoundingClientRect();
  await expect(
    boardRect.top - tools.getBoundingClientRect().bottom
  ).toBeLessThanOrEqual(8);
  await expect(
    picker.getBoundingClientRect().top - boardRect.bottom
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

/** Goals use inset round marks; only physical walls use solid straight edges. */
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
  await expect(view.getComputedStyle(goal, '::before').borderTopStyle).toBe(
    'dotted'
  );
  await expect(view.getComputedStyle(goal, '::before').borderRadius).not.toBe(
    '0px'
  );
}
