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
  const boxes: DOMRect[] = [];
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const button = canvas.getByTestId(`${testId}-blank-${letter}`);
    const box = button.getBoundingClientRect();
    await expect(box.width).toBeGreaterThanOrEqual(44);
    await expect(box.height).toBeGreaterThanOrEqual(44);
    await assertClear(button);
    for (const previous of boxes) {
      await expect(
        box.right <= previous.left ||
          box.left >= previous.right ||
          box.bottom <= previous.top ||
          box.top >= previous.bottom
      ).toBe(true);
    }
    boxes.push(box);
  }
}
