import { expect, userEvent, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';

/** Queries bound to one element, with the default query set. */
function queriesOf(element: HTMLElement) {
  return within(element);
}
type Queries = ReturnType<typeof queriesOf>;

/** The board's View button: a phone keeps its view tools behind it. */
export function boardViewButton(
  canvasElement: HTMLElement
): HTMLElement | null {
  return within(canvasElement).queryByRole('button', { name: 'View board' });
}

/**
 * Where the board's view tools are: beside the board on a wide screen, or in
 * the View dialog on a phone, which this opens from its button.
 */
export async function boardViewTools(
  canvasElement: HTMLElement
): Promise<Queries> {
  const button = boardViewButton(canvasElement);
  if (!button) return queriesOf(canvasElement);
  await assertClear(button);
  await userEvent.click(button);
  const dialog = await within(canvasElement.ownerDocument.body).findByRole(
    'dialog',
    { name: 'Board view' }
  );
  return queriesOf(dialog);
}

/** Close the View dialog, if it is open, and return focus to its button. */
export async function closeBoardView(
  canvasElement: HTMLElement
): Promise<void> {
  const body = within(canvasElement.ownerDocument.body);
  if (!body.queryByRole('dialog', { name: 'Board view' })) return;
  await userEvent.keyboard('{Escape}');
  await expect(
    body.queryByRole('dialog', { name: 'Board view' })
  ).not.toBeInTheDocument();
  await expect(boardViewButton(canvasElement)).toHaveFocus();
}

/** Enlarge the board through its own Enlarge control, wherever it is. */
export async function enlargeBoard(canvasElement: HTMLElement): Promise<void> {
  const tools = await boardViewTools(canvasElement);
  const enlarge = tools.getByRole('button', { name: 'Enlarge board' });
  if (enlarge.getAttribute('aria-pressed') === 'true')
    return closeBoardView(canvasElement);
  await userEvent.click(enlarge);
  await expect(
    within(canvasElement.ownerDocument.body).queryByRole('dialog', {
      name: 'Board view',
    })
  ).not.toBeInTheDocument();
}
