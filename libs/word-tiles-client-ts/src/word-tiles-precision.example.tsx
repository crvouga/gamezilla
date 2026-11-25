import { expect, userEvent, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';
import { boardViewTools, closeBoardView } from './word-tiles-view.example';

/** Phone defaults are measured before any input or focus can scroll the board. */
export async function expectPrecisionDefault(
  canvasElement: HTMLElement,
  testId: string
) {
  // regression: word-tiles-phone-precision-default
  const canvas = within(canvasElement);
  const board = canvas.getByTestId(testId);
  const phone =
    canvasElement.ownerDocument.defaultView?.matchMedia(
      '(max-width: 639px)'
    ).matches;
  await expect(board).toHaveAttribute('data-enlarged', String(phone));
  if (!phone) return;
  const viewport = canvas.getByRole('region', {
    name: 'Scrollable word board',
  });
  await assertClear(viewport, false);
  const bounds = viewport.getBoundingClientRect();
  await expect(bounds.width).toBeGreaterThanOrEqual(308);
  await expect(bounds.height).toBeGreaterThanOrEqual(308);
  const center = canvas.getByTestId(`${testId}-cell-h8`);
  await assertClear(center);
  await expect(center.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
  await expect(center.getBoundingClientRect().height).toBeGreaterThanOrEqual(
    44
  );
  // The phone's view tools wait behind the View button, in a centred dialog.
  const tools = await boardViewTools(canvasElement);
  // regression: word-tiles-region-purpose-hidden
  await assertClear(tools.getByText('View an area'));
  await assertClear(tools.getByText('Outline shows viewing area.'));
  await assertClear(tools.getByText('Find a square'));
  await expect(
    tools.getByRole('button', { name: 'View a1 to e5' })
  ).toHaveTextContent('↖');
  // regression: word-tiles-map-fine-target-detour
  const regions = tools.getByRole('group', { name: 'View a board region' });
  for (const button of within(regions).getAllByRole('button')) {
    await assertClear(button);
    await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      44
    );
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44
    );
  }
  const before = canvas
    .getByTestId(`${testId}-cell-c3`)
    .getAttribute('data-state');
  await userEvent.click(tools.getByRole('button', { name: 'View a1 to e5' }));
  const target = canvas.getByTestId(`${testId}-cell-c3`);
  await expect(target).toHaveFocus();
  await expect(target).toHaveAttribute('data-state', before ?? 'empty');
  await assertClear(target);
  await expect(
    within(canvasElement.ownerDocument.body).queryByRole('dialog')
  ).not.toBeInTheDocument();
  await viewPrecisionRegion(canvasElement, 'View f6 to j10');
}

/** Navigate through the real region controls before clicking a distant placement. */
export async function viewPrecisionRegion(
  canvasElement: HTMLElement,
  name: string
) {
  const tools = await boardViewTools(canvasElement);
  const button = tools.queryByRole('button', { name });
  // A fitted board already exposes every square.
  if (!button) return closeBoardView(canvasElement);
  await assertClear(button);
  await userEvent.click(button);
}
