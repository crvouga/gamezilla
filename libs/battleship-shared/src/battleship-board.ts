/**
 * Classic Battleship geometry: one 10×10 board per side. A cell is named by
 * its lowercase column letter and its row (`a1` … `j10`); cells are indexed
 * row-major from `a1` (index 0) to `j10` (index 99).
 */
export const BOARD_SIZE = 10;
const COLUMN_LETTERS = 'abcdefghij';
export const SHIP_IDS = [
  'carrier',
  'battleship',
  'cruiser',
  'submarine',
  'destroyer',
] as const;
export type ShipId = (typeof SHIP_IDS)[number];
export type Ship = { readonly id: ShipId; readonly length: number };
/** The fleet in canonical order: five distinct ships, 17 cells. */
export const SHIPS: readonly Ship[] = [
  { id: 'carrier', length: 5 },
  { id: 'battleship', length: 4 },
  { id: 'cruiser', length: 3 },
  { id: 'submarine', length: 3 },
  { id: 'destroyer', length: 2 },
];
export const FLEET_CELL_COUNT = 17;
const CELL_PATTERN = /^([a-j])(10|[1-9])$/;

/** The token of the cell at `column` and `row` (both 0-based). */
export function cellAt(column: number, row: number): string {
  return `${COLUMN_LETTERS[column]}${row + 1}`;
}
/** Every cell token in row-major order: `a1`, `b1`, … `j1`, `a2`, … `j10`. */
export const CELLS: readonly string[] = Array.from(
  { length: BOARD_SIZE * BOARD_SIZE },
  (_, index) => cellAt(index % BOARD_SIZE, Math.floor(index / BOARD_SIZE))
);
export type CellCoordinates = { readonly column: number; readonly row: number };
/** The 0-based coordinates of `cell`, or `null` unless it is a board cell. */
export function cellCoordinates(cell: string): CellCoordinates | null {
  const match = CELL_PATTERN.exec(cell);
  if (match === null) return null;
  return {
    column: COLUMN_LETTERS.indexOf(match[1]!),
    row: Number(match[2]) - 1,
  };
}
/** Whether `cell` is exactly one canonical board cell token. */
export function isCell(cell: string): boolean {
  return CELL_PATTERN.test(cell);
}
/** The row-major index of `cell`, or `null` unless it is a board cell. */
export function cellIndex(cell: string): number | null {
  const at = cellCoordinates(cell);
  return at === null ? null : at.row * BOARD_SIZE + at.column;
}
/** The display label of a cell token: `e5` → `E5`. */
export function cellLabel(cell: string): string {
  return cell.toUpperCase();
}
/** The cell `steps` away from `cell` along (`dc`, `dr`), or `null` off the board. */
export function offsetCell(
  cell: string,
  delta: { readonly dc: number; readonly dr: number },
  steps = 1
): string | null {
  const at = cellCoordinates(cell);
  if (at === null) return null;
  const column = at.column + delta.dc * steps;
  const row = at.row + delta.dr * steps;
  return column >= 0 && column < BOARD_SIZE && row >= 0 && row < BOARD_SIZE
    ? cellAt(column, row)
    : null;
}
export const ORTHOGONAL = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
] as const;
/** The board cells orthogonally next to `cell`. */
export function orthogonalNeighbours(cell: string): readonly string[] {
  return ORTHOGONAL.map((delta) => offsetCell(cell, delta)).filter(
    (next): next is string => next !== null
  );
}
export function shipLength(id: ShipId): number {
  return SHIPS.find((ship) => ship.id === id)!.length;
}
export function isShipId(value: string): value is ShipId {
  return (SHIP_IDS as readonly string[]).includes(value);
}
