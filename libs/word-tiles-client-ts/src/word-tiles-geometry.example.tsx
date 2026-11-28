import { expect, within } from 'storybook/test';

/** A short name for a failure message: test id, accessible name or tag. */
function describe(element: Element | null): string {
  if (element === null) return 'nothing';
  const html = element as HTMLElement;
  return (
    html.dataset['testid'] ??
    html.getAttribute('aria-label') ??
    `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 24)}"`
  );
}

async function assertFits(element: HTMLElement, contentFits: boolean) {
  const rect = element.getBoundingClientRect();
  const doc = element.ownerDocument;
  await expect(rect.width).toBeGreaterThan(0);
  await expect(rect.top).toBeGreaterThanOrEqual(0);
  await expect(rect.bottom).toBeLessThanOrEqual(
    doc.documentElement.clientHeight
  );
  await expect(rect.left).toBeGreaterThanOrEqual(0);
  await expect(rect.right).toBeLessThanOrEqual(doc.documentElement.clientWidth);
  if (contentFits)
    await expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
  return rect;
}

/** Corner hit tests catch sticky controls covering an otherwise visible target. */
export async function assertClear(
  element: HTMLElement,
  contentFits = true
): Promise<void> {
  const rect = await assertFits(element, contentFits);
  const doc = element.ownerDocument;
  for (const x of [rect.left + 2, rect.right - 2]) {
    for (const y of [rect.top + 2, rect.bottom - 2]) {
      const hit = doc.elementFromPoint(x, y);
      await expect(
        hit === element || element.contains(hit),
        `corner ${Math.round(x)},${Math.round(y)} of ${describe(element)} is covered by ${describe(hit)}`
      ).toBe(true);
    }
  }
}

/** Check the tray bounds and the hit area of each actual letter. */
export async function assertRackClear(rack: HTMLElement): Promise<void> {
  await assertFits(rack, true);
  for (const tile of within(rack).getAllByRole('button')) {
    await assertClear(tile);
  }
}

/** Pin the accepted-exchange phone checkpoint, both before and after sticky history engages. */
export async function checkExchangeGeometry(
  canvasElement: HTMLElement
): Promise<void> {
  // regression: word-tiles-exchange-history-occlusion
  const action = within(canvasElement).getByTestId(
    'game-session-board-exchange-confirm'
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
  const status = within(canvasElement).getByTestId('game-session-board-status');
  await expect(status).toHaveTextContent(
    'CAT 5 × 2 = 10 points · checked when you play'
  );
  // First prove text fits its own box, even if placement has scrolled the document.
  await expect(status.scrollWidth).toBeLessThanOrEqual(status.clientWidth);
  await expect(status.scrollHeight).toBeLessThanOrEqual(status.clientHeight);
  status.scrollIntoView({ block: 'center', behavior: 'instant' });
  await assertClear(status);
  status.scrollIntoView({ block: 'start', behavior: 'instant' });
  await assertClear(status);
}

/** The next frame of `element`'s window. */
function nextFrame(element: HTMLElement): Promise<void> {
  const view = element.ownerDocument.defaultView;
  return new Promise((resolve) => {
    if (view) view.requestAnimationFrame(() => resolve());
    else resolve();
  });
}

/**
 * Wait until `element`'s box holds still for two frames. A wide game first
 * lays its seats out as a phone's rail, then, once its width is measured,
 * as rows over the board; the board's box takes the room those rows leave
 * a frame later. The initial layout judged is the one that settles.
 */
async function settledLayout(element: HTMLElement): Promise<void> {
  let last = '';
  let still = 0;
  for (let frame = 0; frame < 30 && still < 2; frame += 1) {
    const box = element.getBoundingClientRect();
    const now = [box.top, box.bottom, box.left, box.right].join();
    still = now === last ? still + 1 : 0;
    last = now;
    await nextFrame(element);
  }
}

/** Native initial layout, before any input can scroll the task into view. */
export async function checkInitialWordWorkspace(
  canvasElement: HTMLElement
): Promise<void> {
  // regression: word-tiles-phone-action-overload
  const canvas = within(canvasElement);
  await settledLayout(canvas.getByTestId('game-session-board-rack'));
  const primary = canvas.getByTestId('game-session-board-submit');
  const more = canvas.getByRole('button', { name: 'More actions' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(
    canvas.queryByTestId('game-session-board-recall')
  ).not.toBeInTheDocument();
  // regression: word-tiles-precision-local-score-below-fold
  await assertClear(canvas.getByTestId('game-session-seat-near'));
  await assertClear(primary);
  await assertClear(more);
  await assertRackClear(canvas.getByTestId('game-session-board-rack'));
  const viewport = canvas.getByRole('region', {
    name: 'Scrollable word board',
  });
  await assertClear(viewport, false);
  const board = viewport.getBoundingClientRect();
  await expect(board.width).toBeGreaterThanOrEqual(308);
  await expect(board.height).toBeGreaterThanOrEqual(308);
  const rack = canvas
    .getByTestId('game-session-board-rack')
    .getBoundingClientRect();
  await expect(board.top - rack.bottom).toBeLessThanOrEqual(160);
}
