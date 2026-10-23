/** Coordinates are counted from zero at the top-left, independent of display. */
export type Cell = { readonly x: number; readonly y: number };

export const PAIR_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
] as const;
export type PairColor = (typeof PAIR_COLORS)[number];

export type EndpointPair = {
  readonly id: string;
  readonly label: string;
  readonly color: PairColor;
  readonly endpoints: readonly [Cell, Cell];
};

export type NumberlinkDefinition = {
  readonly format: 1;
  readonly width: number;
  readonly height: number;
  /** The conventional game fills the board; the other variant is explicit. */
  readonly coverage: 'all' | 'pairs';
  readonly pairs: readonly EndpointPair[];
};

export type NumberlinkPath = {
  readonly pairId: string;
  readonly cells: readonly Cell[];
};
export type NumberlinkState = { readonly paths: readonly NumberlinkPath[] };

/** A whole gesture replaces one path atomically; an empty path removes it. */
export type NumberlinkAction = {
  readonly pairId: string;
  readonly cells: readonly Cell[];
};

export type NumberlinkIssue = {
  readonly code: string;
  readonly message: string;
  readonly cell?: Cell;
  readonly pairId?: string;
};

export type Validation<T> =
  | { readonly valid: true; readonly value: T }
  | { readonly valid: false; readonly issues: readonly NumberlinkIssue[] };

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function inBounds(board: NumberlinkDefinition, cell: Cell): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.y) &&
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < board.width &&
    cell.y < board.height
  );
}

export function neighbors(board: NumberlinkDefinition, cell: Cell): Cell[] {
  return [
    { x: cell.x - 1, y: cell.y },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x, y: cell.y + 1 },
  ].filter((candidate) => inBounds(board, candidate));
}
