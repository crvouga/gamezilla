/** Runs in the browser. Measurements are independent of board geometry helpers. */
export const geometryRead = `(() => {
  const board = document.querySelector('[data-testid="browser-board"]');
  const bounds = board.getBoundingClientRect();
  const buttons = [...board.querySelectorAll('[data-square]')];
  const squares = buttons.map(button => {
    const box = button.getBoundingClientRect();
    return { square: button.dataset.square, x: box.left, y: box.top,
      width: box.width, height: box.height };
  });
  const pieces = [...board.querySelectorAll('[data-piece-square]')].map(piece => {
    const box = piece.getBoundingClientRect();
    const square = squares.find(s => s.square === piece.dataset.pieceSquare);
    return { square: piece.dataset.pieceSquare,
      dx: box.left + box.width / 2 - (square.x + square.width / 2),
      dy: box.top + box.height / 2 - (square.y + square.height / 2),
      hasSvg: getComputedStyle(piece).backgroundImage.startsWith('url("data:image/svg+xml,') };
  });
  const misses = [];
  const probe = document.querySelector('[data-testid="browser-board-probe"]');
  for (const square of squares) {
    window.boardExample.tapAt(square.x + square.width / 2, square.y + square.height / 2);
    if (JSON.parse(probe.textContent).cursor !== square.square) misses.push(square.square);
  }
  return { width: bounds.width, height: bounds.height, squares, pieces, misses };
})()`;

export type BoardGeometry = {
  readonly width: number;
  readonly height: number;
  readonly squares: readonly {
    square: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  readonly pieces: readonly {
    square: string;
    dx: number;
    dy: number;
    hasSvg: boolean;
  }[];
  readonly misses: readonly string[];
};
