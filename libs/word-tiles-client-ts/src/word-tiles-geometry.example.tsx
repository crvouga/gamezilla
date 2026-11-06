import { expect, within } from 'storybook/test';

/** Full box visibility, including corner hit testing; toBeVisible alone misses sticky overlap. */
async function assertClear(element: HTMLElement): Promise<void> {
  const rect = element.getBoundingClientRect();
  const doc = element.ownerDocument;
  await expect(rect.width).toBeGreaterThan(0);
  await expect(rect.top).toBeGreaterThanOrEqual(0);
  await expect(rect.bottom).toBeLessThanOrEqual(
    doc.documentElement.clientHeight
  );
  await expect(rect.left).toBeGreaterThanOrEqual(0);
  await expect(rect.right).toBeLessThanOrEqual(doc.documentElement.clientWidth);
  await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
  for (const x of [rect.left + 2, rect.right - 2]) {
    for (const y of [rect.top + 2, rect.bottom - 2]) {
      const hit = doc.elementFromPoint(x, y);
      await expect(hit === element || element.contains(hit)).toBe(true);
    }
  }
}

/** Pin the accepted-exchange phone checkpoint, both before and after sticky history engages. */
export async function checkExchangeGeometry(
  canvasElement: HTMLElement
): Promise<void> {
  // regression: word-tiles-exchange-history-occlusion
  const action = within(canvasElement).getByTestId(
    'custom-game-board-exchange-confirm'
  );
  await assertClear(action);
  action.scrollIntoView({ block: 'start', behavior: 'instant' });
  await assertClear(action);
}

/** Pin the unavailable-list CAT sentence, before and after scrolling it into the history boundary. */
export async function checkCatStatusGeometry(
  canvasElement: HTMLElement
): Promise<void> {
  // regression: word-tiles-cat-status-clipping
  const status = within(canvasElement).getByTestId('custom-game-board-status');
  await expect(status).toHaveTextContent('Scores 10 points.');
  await expect(status).toHaveTextContent(
    'the game checks the words when you play'
  );
  // First prove text fits its own box, even if placement has scrolled the document.
  await expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth);
  await expect(status.scrollHeight).toBeLessThanOrEqual(status.clientHeight);
  status.scrollIntoView({ block: 'center', behavior: 'instant' });
  await assertClear(status);
  status.scrollIntoView({ block: 'start', behavior: 'instant' });
  await assertClear(status);
}
