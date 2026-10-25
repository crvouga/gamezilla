/** Coordinates are counted from zero at the top-left square, A1. */
export type Cell = { readonly x: number; readonly y: number };

export const SOKOBAN_SQUARES = ['wall', 'floor', 'goal', 'outside'] as const;
export type SokobanSquare = (typeof SOKOBAN_SQUARES)[number];

/**
 * The board as built: terrain in row-major order plus the pieces standing on
 * it. A draft board may be incomplete (no worker, any crate and goal counts).
 * Crates are kept in row-major order so a board has one encoding.
 */
export type SokobanBoard = {
  readonly width: number;
  readonly height: number;
  readonly squares: readonly SokobanSquare[];
  readonly worker: Cell | null;
  readonly crates: readonly Cell[];
};

/**
 * Where the worker and crates stand at one moment of play. Crate `i` keeps its
 * index for the whole attempt; the starting order is the board's crates in
 * row-major order.
 */
export type SokobanPosition = {
  readonly worker: Cell;
  readonly crates: readonly Cell[];
  readonly moves: number;
  readonly pushes: number;
};

export const SOKOBAN_DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type SokobanDirection = (typeof SOKOBAN_DIRECTIONS)[number];

export const SOKOBAN_MAX_SIZE = 20;
export const SOKOBAN_MIN_SIZE = 1;

export type SokobanIssue = {
  readonly code: string;
  readonly message: string;
};

export type Validation<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly issues: readonly SokobanIssue[] };

export function refuse<T>(code: string, message: string): Validation<T> {
  return { valid: false, issues: [{ code, message }] };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Row-major order: top row first, then left to right. */
export function compareCells(a: Cell, b: Cell): number {
  return a.y === b.y ? a.x - b.x : a.y - b.y;
}

export function inBounds(
  board: Pick<SokobanBoard, 'width' | 'height'>,
  cell: Cell
): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < board.width &&
    cell.y < board.height
  );
}

/** The square at `cell`, or `null` beyond the board's edge. */
export function squareAt(
  board: Pick<SokobanBoard, 'width' | 'height' | 'squares'>,
  cell: Cell
): SokobanSquare | null {
  return inBounds(board, cell)
    ? (board.squares[cell.y * board.width + cell.x] ?? null)
    : null;
}

/** The worker and crates stand only on floor or goals. */
export function isStandable(square: SokobanSquare | null): boolean {
  return square === 'floor' || square === 'goal';
}

const OFFSETS: Readonly<Record<SokobanDirection, Cell>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function stepCell(cell: Cell, direction: SokobanDirection): Cell {
  const offset = OFFSETS[direction];
  return { x: cell.x + offset.x, y: cell.y + offset.y };
}

const COLUMN_LETTERS = 'ABCDEFGHIJKLMNOPQRST';
const SQUARE_NAME = /^([A-T])([1-9]|1[0-9]|20)$/;

/** `{ x: 0, y: 0 }` is A1: column letter A–T, row number from 1 at the top. */
export function squareName(cell: Cell): string {
  const letter = COLUMN_LETTERS[cell.x];
  if (
    letter === undefined ||
    !Number.isInteger(cell.y) ||
    cell.y < 0 ||
    cell.y >= SOKOBAN_MAX_SIZE
  )
    throw new Error(`No square is named for ${cell.x},${cell.y}`);
  return `${letter}${cell.y + 1}`;
}

/** The cell a name such as `A1` names, or `null` when it names no square. */
export function parseSquareName(name: string): Cell | null {
  const match = SQUARE_NAME.exec(name);
  if (match === null) return null;
  return {
    x: COLUMN_LETTERS.indexOf(match[1] ?? ''),
    y: Number(match[2]) - 1,
  };
}
