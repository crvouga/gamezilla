export type BoardMove =
  | { kind: 'pawn'; from: string; to: string }
  | { kind: 'wall'; anchor: string; horizontal: boolean };

/** Squares stay mounted. Mark only the pawn or four edges changed by this turn. */
export function paintMove(board: HTMLElement, move: BoardMove) {
  const cell = (id: string) =>
    board.querySelector<HTMLElement>(`[data-cell="${id}"]`);
  if (move.kind === 'pawn') {
    const from = cell(move.from);
    const to = cell(move.to);
    if (!from || !to) return;
    to.style.setProperty('--travel-x', from.offsetLeft - to.offsetLeft + 'px');
    to.style.setProperty('--travel-y', from.offsetTop - to.offsetTop + 'px');
    to.dataset['arriving'] = 'pawn';
    return () => {
      delete to.dataset['arriving'];
      to.style.removeProperty('--travel-x');
      to.style.removeProperty('--travel-y');
    };
  }
  const index = Number(cell(move.anchor)?.dataset['index']);
  const marked = [0, 1, -9, -8].map((offset) => {
    const square = board.querySelector<HTMLElement>(
      `[data-index="${index + offset}"]`
    );
    if (square)
      square.dataset['arriving'] = move.horizontal
        ? offset < 0
          ? 'bottom'
          : 'top'
        : offset === 1 || offset === -8
          ? 'left'
          : 'right';
    return square;
  });
  return () => {
    for (const square of marked) if (square) delete square.dataset['arriving'];
  };
}
