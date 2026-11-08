import { expect, userEvent, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';

/** The repository's standard phone viewport, 390x844. */
const DESIGN_PHONE_HEIGHT = 844;

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
  // The 390x844 design phone shows the whole overview before any scroll. A
  // shorter phone keeps the play workspace above (rack, actions, board) and
  // must bring the complete overview clear by scrolling the page.
  const short =
    (canvasElement.ownerDocument.defaultView?.innerHeight ?? 0) <
    DESIGN_PHONE_HEIGHT;
  if (short)
    canvas
      .getByRole('group', { name: 'View a board region' })
      .closest('[data-overview]')
      ?.scrollIntoView({ block: 'end', behavior: 'instant' });
  // regression: word-tiles-region-purpose-hidden
  await assertClear(canvas.getByText('View an area'));
  await assertClear(canvas.getByText('Outline shows viewing area.'));
  await assertClear(canvas.getByText('Find a square'));
  await expect(
    canvas.getByRole('button', { name: 'View a1 to e5' })
  ).toHaveTextContent('↖');
  // regression: word-tiles-map-fine-target-detour
  const regions = canvas.getByRole('group', { name: 'View a board region' });
  for (const button of within(regions).getAllByRole('button')) {
    await assertClear(button);
    await expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      44
    );
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      44
    );
  }
  if (short) viewport.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  const before = canvas
    .getByTestId(`${testId}-cell-c3`)
    .getAttribute('data-state');
  await userEvent.click(canvas.getByRole('button', { name: 'View a1 to e5' }));
  const target = canvas.getByTestId(`${testId}-cell-c3`);
  await expect(target).toHaveFocus();
  await expect(target).toHaveAttribute('data-state', before ?? 'empty');
  await assertClear(target);
  await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole('button', { name: 'View f6 to j10' }));
}

/** Navigate through the real region controls before clicking a distant placement. */
export async function viewPrecisionRegion(
  canvasElement: HTMLElement,
  name: string
) {
  const button = within(canvasElement).queryByRole('button', { name });
  if (!button) return; // Fitted desktop boards already expose every square.
  await assertClear(button);
  await userEvent.click(button);
}
