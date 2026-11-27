// @io-wall-ok — browser timing probe, never product scheduling.
import type { Page } from '@playwright/test';

/** One real input and the move count it must reach. */
export type TimedStep = (page: Page, index: number) => Promise<number>;

/** The board is focused once before timing; walking never changes focus. */
export function walking(startingMoves: number): TimedStep {
  return async (page, index) => {
    await page.keyboard.press(index % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
    return startingMoves + index + 1;
  };
}

/** Resolve the two input targets before CPU throttling and observation.
 * Every Undo uses the real mouse at the button's resting position. */
export async function withPushAndUndo(
  page: Page,
  measure: (step: TimedStep) => Promise<void>
) {
  const point = await page
    .getByRole('button', { name: 'Undo', exact: true })
    .evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (!button.contains(button.ownerDocument.elementFromPoint(x, y)))
        throw new Error(
          'The Undo button cannot receive a pointer at its centre'
        );
      return { x, y };
    });
  const board = await page.getByTestId('sokoban-board').elementHandle();
  if (!board) throw new Error('Missing playable Sokoban board');
  try {
    await measure(async (browser, index) => {
      if (index % 2 === 0) {
        // Clicking Undo moves focus away from the board.
        await board.focus();
        await browser.keyboard.press('ArrowRight');
        return 1;
      }
      await browser.mouse.click(point.x, point.y);
      return 0;
    });
  } finally {
    await board.dispose();
  }
}

/** Check every move after its frame before sending the next real input. */
export async function runSokobanMoves(
  page: Page,
  step: TimedStep,
  readAfterFrame: (expected: number) => Promise<string | null>
): Promise<void> {
  for (let index = 0; index < 20; index++) {
    const expected = await step(page, index);
    const actual = await readAfterFrame(expected);
    if (actual !== String(expected)) {
      throw new Error(
        `Sokoban timed input ${index + 1}: expected ${expected} moves, received ${actual}`
      );
    }
  }
}

/** Same five-second count-assertion budget, sampled on frames without DOM queries. */
export function readSokobanMoveFrame(element: Element, expected: number) {
  const deadline = performance.now() + 5000;
  return new Promise<string | null>((resolve) => {
    const read = () => {
      const actual = element.getAttribute('data-moves');
      if (actual === String(expected) || performance.now() >= deadline) {
        resolve(actual);
      } else requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
  });
}

/** Resolve the count once outside timing, avoiding locator scans per move. */
export async function prepareSokobanMoves(page: Page) {
  const count = await page.getByTestId('sokoban-counts').elementHandle();
  if (!count) throw new Error('Missing move count');
  return {
    readAfterFrame: (expected: number) =>
      count.evaluate(readSokobanMoveFrame, expected),
    dispose: () => count.dispose(),
  };
}
