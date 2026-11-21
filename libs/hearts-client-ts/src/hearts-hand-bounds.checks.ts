/** Bounds shared by the browser journey and literal geometry regressions. */
type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};
export function assertHeartsHandBounds(
  cards: readonly Bounds[],
  viewport: { width: number; height: number }
) {
  for (const card of cards) {
    if (
      card.left < 0 ||
      card.top < 0 ||
      card.right > viewport.width ||
      card.bottom > viewport.height
    )
      throw new Error('Hearts hand extends outside the viewport');
    if (card.width < 44 || card.height < 44)
      throw new Error('Hearts card target is smaller than 44px');
  }
  for (const [index, card] of cards.entries()) {
    for (const other of cards.slice(index + 1)) {
      if (
        card.left < other.right &&
        card.right > other.left &&
        card.top < other.bottom &&
        card.bottom > other.top
      )
        throw new Error('Hearts cards overlap');
    }
  }
}

/** Initial deal, including the action and context, before any focus or click. */
export function assertHeartsPassingBounds(
  cards: readonly Bounds[],
  context: Bounds,
  action: Bounds,
  viewport: { width: number; height: number }
) {
  if (cards.length !== 13)
    throw new Error('Expected the complete 13-card deal');
  assertHeartsHandBounds(cards, viewport);
  assertHeartsHandBounds([context], viewport);
  assertHeartsContextBounds(context);
  assertHeartsHandBounds([action], viewport);
}

/** Uses the canvas document, with settled fonts, without scrolling any locator. */
export async function checkInitialHeartsDeal(canvas: HTMLElement) {
  const doc = canvas.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new Error('Hearts canvas has no viewport');
  await doc.fonts.ready;
  const board = canvas.querySelector<HTMLElement>(
    '[data-component="CardTable"]'
  );
  const hand = board?.querySelector('[role="toolbar"]');
  const context =
    board?.querySelector('[data-testid="custom-game-board-table-toggle"]') ??
    board?.querySelector('[role="group"]');
  const action = board?.querySelector('[data-testid="custom-game-board-pass"]');
  if (!board || !hand || !context || !action)
    throw new Error('Initial Hearts deal is missing its hand, context or pass');
  for (
    let node: HTMLElement | null = hand as HTMLElement;
    node;
    node = node.parentElement
  ) {
    if (node.scrollTop !== 0 || node.scrollLeft !== 0)
      throw new Error(
        'Initial Hearts deal was scrolled before its bounds check'
      );
  }
  // regression: hearts-seat-fact-wrap-separator
  for (const fact of board.querySelectorAll('section > span > span')) {
    const separator = view.getComputedStyle(fact, '::before').content;
    if (separator !== 'none' && separator !== 'normal')
      throw new Error(
        'Hearts facts must not start a wrapped line with a separator'
      );
  }
  assertHeartsPassingBounds(
    [...hand.querySelectorAll('button')].map((card) =>
      card.getBoundingClientRect()
    ),
    context.getBoundingClientRect(),
    action.getBoundingClientRect(),
    { width: view.innerWidth, height: view.innerHeight }
  );
}

/** A phone's named player and played card occupy the same row. */
export function assertHeartsSeatRow(seat: Bounds, slot: Bounds) {
  if (
    slot.left < seat.right ||
    slot.left - seat.right > 8 ||
    slot.top >= seat.bottom ||
    slot.bottom <= seat.top
  )
    throw new Error('Hearts trick card is not beside its named player');
}

export function checkHeartsSeatRows(canvas: HTMLElement) {
  const board = canvas.querySelector<HTMLElement>(
    '[data-component="CardTable"]'
  );
  if (!board || board.clientWidth >= 480) return;
  const context = board.querySelector('[role="group"]');
  if (!context) throw new Error('Missing Hearts table');
  assertHeartsContextBounds(context.getBoundingClientRect());
  for (const seat of board.querySelectorAll('section[data-position]')) {
    const slot = board.querySelector(
      `span[data-position="${seat.getAttribute('data-position')}"]`
    );
    if (!slot) throw new Error('Missing named trick place');
    assertHeartsSeatRow(
      seat.getBoundingClientRect(),
      slot.getBoundingClientRect()
    );
  }
}

/** The phone table must leave space for the full hand and its pass action. */
export function assertHeartsContextBounds(context: Bounds) {
  if (context.width < 480 && context.height > 256)
    throw new Error('Hearts phone context crowds the hand');
}
