import {
  type Cell,
  compareCells,
  inBounds,
  isStandable,
  refuse,
  SOKOBAN_MAX_SIZE,
  SOKOBAN_MIN_SIZE,
  type SokobanBoard,
  type SokobanSquare,
  sameCell,
  squareAt,
  type Validation,
} from './sokoban-types';

/** Something a smaller board took away beyond its new edge. */
export type SokobanRemoval = {
  readonly kind: 'worker' | 'crate' | 'goal';
  readonly cell: Cell;
};

export type SokobanResize = {
  readonly board: SokobanBoard;
  /** In row-major order; on one square the worker or crate comes before its goal. */
  readonly removed: readonly SokobanRemoval[];
};

function offBoard<T>(): Validation<T> {
  return refuse('not_on_board', 'Choose a square on the board.');
}

function crateAt(board: SokobanBoard, cell: Cell): boolean {
  return board.crates.some((crate) => sameCell(crate, cell));
}

function workerAt(board: SokobanBoard, cell: Cell): boolean {
  return board.worker !== null && sameCell(board.worker, cell);
}

function withSquare(
  board: SokobanBoard,
  cell: Cell,
  square: SokobanSquare
): readonly SokobanSquare[] {
  const index = cell.y * board.width + cell.x;
  return board.squares.map((entry, at) => (at === index ? square : entry));
}

function removalsBeyond(
  board: SokobanBoard,
  width: number,
  height: number
): SokobanRemoval[] {
  const removed: SokobanRemoval[] = [];
  for (let y = 0; y < board.height; y += 1)
    for (let x = 0; x < board.width; x += 1) {
      if (x < width && y < height) continue;
      const cell = { x, y };
      if (workerAt(board, cell)) removed.push({ kind: 'worker', cell });
      if (crateAt(board, cell)) removed.push({ kind: 'crate', cell });
      if (squareAt(board, cell) === 'goal')
        removed.push({ kind: 'goal', cell });
    }
  return removed;
}

/**
 * Growing adds floor at the right and bottom; shrinking crops from the right
 * and bottom and reports the worker, crates and goals beyond the new edge.
 */
export function resizeSokobanBoard(
  board: SokobanBoard,
  width: number,
  height: number
): Validation<SokobanResize> {
  if (!Number.isInteger(width) || !Number.isInteger(height))
    return refuse('invalid_size', 'Choose a whole number of columns and rows.');
  if (width > SOKOBAN_MAX_SIZE || height > SOKOBAN_MAX_SIZE)
    return refuse(
      'board_too_large',
      'A board has at most 20 columns and 20 rows.'
    );
  if (width < SOKOBAN_MIN_SIZE || height < SOKOBAN_MIN_SIZE)
    return refuse(
      'board_too_small',
      'A board has at least 1 column and 1 row.'
    );
  if (width === board.width && height === board.height)
    return { valid: true, value: { board, removed: [] } };
  const size = { width, height };
  const squares = Array.from(
    { length: width * height },
    (_, index): SokobanSquare =>
      squareAt(board, { x: index % width, y: Math.floor(index / width) }) ??
      'floor'
  );
  return {
    valid: true,
    value: {
      board: {
        width,
        height,
        squares,
        worker:
          board.worker !== null && inBounds(size, board.worker)
            ? board.worker
            : null,
        crates: board.crates.filter((crate) => inBounds(size, crate)),
      },
      removed: removalsBeyond(board, width, height),
    },
  };
}

/**
 * A wall or outside square removes the piece on it; a goal or floor keeps it.
 * Painting a square as it already is returns the same board.
 */
export function paintSokobanSquare(
  board: SokobanBoard,
  cell: Cell,
  square: SokobanSquare
): Validation<SokobanBoard> {
  const current = squareAt(board, cell);
  if (current === null) return offBoard();
  if (current === square) return { valid: true, value: board };
  const keeps = isStandable(square);
  return {
    valid: true,
    value: {
      ...board,
      squares: withSquare(board, cell, square),
      worker: keeps || !workerAt(board, cell) ? board.worker : null,
      crates: keeps
        ? board.crates
        : board.crates.filter((crate) => !sameCell(crate, cell)),
    },
  };
}

/** Erasing makes the square floor, removing any piece or goal on it. */
export function eraseSokobanSquare(
  board: SokobanBoard,
  cell: Cell
): Validation<SokobanBoard> {
  const current = squareAt(board, cell);
  if (current === null) return offBoard();
  if (current === 'floor' && !workerAt(board, cell) && !crateAt(board, cell))
    return { valid: true, value: board };
  return {
    valid: true,
    value: {
      ...board,
      squares: withSquare(board, cell, 'floor'),
      worker: workerAt(board, cell) ? null : board.worker,
      crates: board.crates.filter((crate) => !sameCell(crate, cell)),
    },
  };
}

function placementRefusal<T>(
  board: SokobanBoard,
  cell: Cell
): Validation<T> | null {
  const square = squareAt(board, cell);
  if (square === null) return offBoard();
  if (!isStandable(square))
    return refuse(
      'not_standable',
      'The worker and crates stand only on floor or goals.'
    );
  if (crateAt(board, cell))
    return refuse('occupied', 'That square already has a piece.');
  return null;
}

/** A board has one worker, so placing it again takes it from its earlier square. */
export function placeSokobanWorker(
  board: SokobanBoard,
  cell: Cell
): Validation<SokobanBoard> {
  const refusal = placementRefusal<SokobanBoard>(board, cell);
  if (refusal !== null) return refusal;
  if (workerAt(board, cell)) return { valid: true, value: board };
  return { valid: true, value: { ...board, worker: { x: cell.x, y: cell.y } } };
}

export function placeSokobanCrate(
  board: SokobanBoard,
  cell: Cell
): Validation<SokobanBoard> {
  const refusal = placementRefusal<SokobanBoard>(board, cell);
  if (refusal !== null) return refusal;
  if (workerAt(board, cell))
    return refuse('occupied', 'That square already has a piece.');
  return {
    valid: true,
    value: {
      ...board,
      crates: [...board.crates, { x: cell.x, y: cell.y }].sort(compareCells),
    },
  };
}

/** Removing a crate leaves the square's floor or goal as it was. */
export function removeSokobanCrate(
  board: SokobanBoard,
  cell: Cell
): Validation<SokobanBoard> {
  if (squareAt(board, cell) === null) return offBoard();
  if (!crateAt(board, cell))
    return refuse('no_crate', 'There is no crate on that square.');
  return {
    valid: true,
    value: {
      ...board,
      crates: board.crates.filter((crate) => !sameCell(crate, cell)),
    },
  };
}

/** A small playable walled room for a new draft: worker, one crate, one goal. */
export function initialSokobanDefinition(): string {
  return JSON.stringify({
    format: 1,
    rows: ['######', '#    #', '#@$ .#', '#    #', '######'],
  });
}
