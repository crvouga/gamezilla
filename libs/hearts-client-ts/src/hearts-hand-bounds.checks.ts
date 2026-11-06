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
