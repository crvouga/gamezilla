import { expect, within } from 'storybook/test';
import { assertClear } from './word-tiles-geometry.example';

/** Measure actual disjoint controls before a click can scroll the chooser. */
export async function expectBlankTargets(
  canvasElement: HTMLElement,
  testId: string
) {
  // regression: word-tiles-blank-letter-content-overflow
  // regression: word-tiles-blank-small-targets
  const canvas = within(canvasElement);
  // regression: word-tiles-blank-duplicate-instruction
  await expect(
    canvas.getAllByText(/^Choose the letter your blank plays\.?$/)
  ).toHaveLength(1);
  // regression: word-tiles-blank-assignment-context
  const dialog = canvas.getByRole('dialog', {
    name: 'Choose the letter your blank plays',
  });
  const context = canvas.getByTestId(`${testId}-blank-context`);
  await assertClear(context);
  await expect(context).toHaveTextContent(
    testId === 'word-tiles-puzzle'
      ? 'Target: 20 points'
      : 'Scores: Amber 0, Teal 0'
  );
  await expect(context).toHaveTextContent(
    testId === 'word-tiles-puzzle' ? 'Blank at j8' : 'Blank at h8'
  );
  await expect(context.querySelectorAll('[data-blank]')).toHaveLength(21);
  await expect(context.querySelectorAll('[data-blank="true"]')).toHaveLength(1);
  await assertClear(
    within(dialog).getByRole('button', { name: 'Cancel blank placement' })
  );
  // The modal owns hit testing; the underlying precision board must not shrink.
  const viewport = canvas.getByRole('region', {
    name: 'Scrollable word board',
  });
  const bounds = viewport.getBoundingClientRect();
  await expect(bounds.width).toBeGreaterThanOrEqual(308);
  await expect(bounds.height).toBeGreaterThanOrEqual(308);
  await expect(bounds.top).toBeGreaterThanOrEqual(0);
  await expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
  const boxes: DOMRect[] = [];
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const button = canvas.getByTestId(`${testId}-blank-${letter}`);
    const box = button.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(44);
    await expect(box.height).toBeGreaterThanOrEqual(44);
    await assertClear(button);
    for (const previous of boxes) {
      await expect(
        box.right + 4 <= previous.left ||
          box.left >= previous.right + 4 ||
          box.bottom + 4 <= previous.top ||
          box.top >= previous.bottom + 4
      ).toBe(true);
    }
    boxes.push(box);
  }
}
