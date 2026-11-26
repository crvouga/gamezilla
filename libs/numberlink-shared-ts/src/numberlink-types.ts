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

/**
 * Validator outputs are frozen through and remembered by identity, so a
 * value a validator already accepted is never checked again: one move
 * reads its board and progress once instead of at every step.
 */
const accepted = new WeakMap<object, object>();
/** The context of an accepted board, so a board is never taken for progress. */
const BOARD = Object.freeze({});

function freezeDeep<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

/** Marks a fresh validator output as accepted on `board`, or as a board itself. */
export function accept<T extends object>(value: T, board?: object): T {
  accepted.set(freezeDeep(value), board ?? BOARD);
  return value;
}

/** Whether `value` is an output a validator accepted on `board`, or as a board. */
export function wasAccepted(value: unknown, board?: object): boolean {
  if (typeof value !== 'object' || value === null) return false;
  return accepted.get(value) === (board ?? BOARD);
}
