/**
 * The 15 × 15 board: cells, their names and the bonus squares. Cell `n`
 * is row `floor(n / 15)` (row 1 at the top), column `n % 15` (column `a` at
 * the left); it is written `<column><row>`, so the centre is `h8`.
 */

export const BOARD_SIZE = 15;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
export const CENTER_CELL = 7 * BOARD_SIZE + 7;
const COLUMNS = 'abcdefghijklmno';

export type BonusSquare = 'DL' | 'TL' | 'DW' | 'TW';

export function cellRow(cell: number): number {
  return Math.floor(cell / BOARD_SIZE);
}

export function cellColumn(cell: number): number {
  return cell % BOARD_SIZE;
}

export function cellAt(row: number, column: number): number | null {
  return row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE
    ? null
    : row * BOARD_SIZE + column;
}

export function cellName(cell: number): string {
  return `${COLUMNS[cellColumn(cell)]}${cellRow(cell) + 1}`;
}

/** The cell `name` (`h8`) names, or `null` when it is not a board cell. */
export function parseCell(name: string): number | null {
  const match = /^([a-o])([1-9]|1[0-5])$/.exec(name);
  if (match === null) return null;
  return cellAt(Number(match[2]) - 1, COLUMNS.indexOf(match[1]!));
}

/**
 * The bonus-square layout, given once for the cells with `row <= column <= 7`
 * of the upper-left quadrant; the board repeats it under every reflection
 * across its middle row, middle column and diagonals, so it is symmetric by
 * construction. The layout is original to this game: eight triple-word
 * squares on the edges, four squares from each corner; double-word
 * squares near the edges and on the diagonals; the centre is a double-word
 * square. 8 triple-word, 13 double-word, 12 triple-letter and 28
 * double-letter squares.
 */
const CANONICAL_BONUS_SQUARES: readonly (readonly [
  number,
  number,
  BonusSquare,
])[] = [
  [0, 4, 'TW'],
  [1, 6, 'DW'],
  [3, 3, 'DW'],
  [7, 7, 'DW'],
  [2, 4, 'TL'],
  [5, 7, 'TL'],
  [0, 0, 'DL'],
  [0, 7, 'DL'],
  [1, 3, 'DL'],
  [4, 6, 'DL'],
  [6, 6, 'DL'],
];

function orbit(row: number, column: number): readonly number[] {
  const last = BOARD_SIZE - 1;
  const cells = new Set<number>();
  for (const [r, c] of [
    [row, column],
    [column, row],
  ] as const)
    for (const rr of [r, last - r])
      for (const cc of [c, last - c]) cells.add(rr * BOARD_SIZE + cc);
  return [...cells];
}

function buildBonusSquares(): ReadonlyMap<number, BonusSquare> {
  const squares = new Map<number, BonusSquare>();
  for (const [row, column, square] of CANONICAL_BONUS_SQUARES) {
    if (!(row <= column && column <= 7))
      throw new Error(
        `bonus square ${row},${column} is outside the canonical part`
      );
    for (const cell of orbit(row, column)) {
      const existing = squares.get(cell);
      if (existing !== undefined && existing !== square)
        throw new Error(`bonus square conflict at ${cellName(cell)}`);
      squares.set(cell, square);
    }
  }
  if (squares.get(CENTER_CELL) !== 'DW')
    throw new Error('the centre must be a double-word square');
  return squares;
}

/** Every bonus square, by cell. */
export const BONUS_SQUARES: ReadonlyMap<number, BonusSquare> =
  buildBonusSquares();

export function bonusSquareAt(cell: number): BonusSquare | null {
  return BONUS_SQUARES.get(cell) ?? null;
}

export function letterMultiplier(square: BonusSquare | null): number {
  return square === 'DL' ? 2 : square === 'TL' ? 3 : 1;
}

export function wordMultiplier(square: BonusSquare | null): number {
  return square === 'DW' ? 2 : square === 'TW' ? 3 : 1;
}

/** The orthogonal neighbours of `cell` that are on the board. */
export function neighbours(cell: number): readonly number[] {
  const row = cellRow(cell);
  const column = cellColumn(cell);
  return [
    cellAt(row - 1, column),
    cellAt(row + 1, column),
    cellAt(row, column - 1),
    cellAt(row, column + 1),
  ].filter((n): n is number => n !== null);
}
