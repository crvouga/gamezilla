/** Runs in the browser. Measurements are independent of board geometry helpers. */
export const geometryRead = `(() => {
  const board = document.querySelector('[data-testid="browser-board"]');
  const bounds = board.getBoundingClientRect();
  const buttons = [...board.querySelectorAll('[data-square]')];
  const squares = buttons.map(button => {
    const box = button.getBoundingClientRect();
    return { square: button.dataset.square, x: box.left, y: box.top,
      width: box.width, height: box.height, cssWidth:getComputedStyle(button).width, transform:getComputedStyle(button).transform };
  });
  const pieces = [...board.querySelectorAll('[data-piece-square]')].map(piece => {
    const box = piece.getBoundingClientRect();
    const square = squares.find(s => s.square === piece.dataset.pieceSquare);
    return { square: piece.dataset.pieceSquare,
      dx: box.left + box.width / 2 - (square.x + square.width / 2),
      dy: box.top + box.height / 2 - (square.y + square.height / 2),
      width: box.width, height: box.height, image: getComputedStyle(piece).backgroundImage };
  });
  const misses = [];
  for (const square of squares) {
    window.boardExample.tap(square.square);
    const probe = JSON.parse(document.querySelector('[data-testid="browser-board-probe"]').textContent);
    if (probe.cursor !== square.square) misses.push(square.square);
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
    image: string;
  }[];
  readonly misses: readonly string[];
};
