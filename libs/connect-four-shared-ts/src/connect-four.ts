/** Classic ruleset v1. Rows count up from the floor; columns never rotate. */
export const CONNECT_FOUR_ID = 'connect-four';
export const CONNECT_FOUR_PREFIX = 'c4:1:';
export const COLUMNS = 7;
export const ROWS = 6;
export type Disc = 1 | 2;
export type Cell = 0 | Disc;
export type ConnectFour = {
  readonly board: readonly Cell[];
  readonly moves: readonly number[];
  readonly turn: Disc;
  /** 0 = playing, 1/2 = winner, 3 = draw. */
  readonly result: 0 | Disc | 3;
  readonly winning: readonly number[];
};
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;
export function newConnectFour(): ConnectFour {
  return {
    board: Array<Cell>(42).fill(0),
    moves: [],
    turn: 1,
    result: 0,
    winning: [],
  };
}
export function landingCell(game: ConnectFour, column: number): number | null {
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) return null;
  for (let row = 0; row < ROWS; row++) {
    const cell = row * COLUMNS + column;
    if (game.board[cell] === 0) return cell;
  }
  return null;
}
export function legalColumns(game: ConnectFour): readonly number[] {
  return game.result === 0
    ? Array.from({ length: COLUMNS }, (_, c) => c).filter(
        (c) => landingCell(game, c) !== null
      )
    : [];
}
/** Includes every disc in every winning line, including intersecting lines. */
export function winningCells(
  board: readonly Cell[],
  player: Disc
): readonly number[] {
  const found = new Set<number>();
  for (let cell = 0; cell < 42; cell++) {
    for (const [dx, dy] of DIRECTIONS) {
      const line = Array.from({ length: 4 }, (_, n) => {
        const x = (cell % COLUMNS) + dx * n;
        const y = Math.floor(cell / COLUMNS) + dy * n;
        return x >= 0 && x < COLUMNS && y >= 0 && y < ROWS
          ? y * COLUMNS + x
          : -1;
      });
      if (line.every((i) => i >= 0 && board[i] === player))
        for (const i of line) found.add(i);
    }
  }
  return [...found].sort((a, b) => a - b);
}
function winsAt(board: readonly Cell[], cell: number, player: Disc): boolean {
  return DIRECTIONS.some(([dx, dy]) => {
    let length = 1;
    for (const direction of [-1, 1]) {
      let x = (cell % COLUMNS) + direction * dx;
      let y = Math.floor(cell / COLUMNS) + direction * dy;
      while (
        x >= 0 &&
        x < COLUMNS &&
        y >= 0 &&
        y < ROWS &&
        board[y * COLUMNS + x] === player
      ) {
        length++;
        x += direction * dx;
        y += direction * dy;
      }
    }
    return length >= 4;
  });
}
export function dropDisc(
  game: ConnectFour,
  column: number,
  player: Disc = game.turn
): ConnectFour | null {
  if (game.result !== 0 || player !== game.turn) return null;
  const cell = landingCell(game, column);
  if (cell === null) return null;
  const board = [...game.board];
  board[cell] = player;
  const moves = [...game.moves, column];
  const won = winsAt(board, cell, player);
  return {
    board,
    moves,
    turn: player === 1 ? 2 : 1,
    result: won ? player : moves.length === 42 ? 3 : 0,
    winning: won ? winningCells(board, player) : [],
  };
}
export function replayConnectFour(moves: readonly number[]): ConnectFour {
  if (moves.length > 42)
    throw new Error('Connect Four history exceeds board capacity');
  let game = newConnectFour();
  for (const column of moves) {
    const next = dropDisc(game, column);
    if (next === null) throw new Error('Invalid Connect Four history');
    game = next;
  }
  return game;
}
export function encodeConnectFour(game: ConnectFour): string {
  return CONNECT_FOUR_PREFIX + game.moves.join('');
}
/** The versioned, accepted drops are the authority; derived cells cannot be forged. */
export function decodeConnectFour(position: string): ConnectFour {
  if (!/^c4:1:[0-6]{0,42}$/.test(position))
    throw new Error('Invalid Connect Four ruleset or history');
  return replayConnectFour(
    [...position.slice(CONNECT_FOUR_PREFIX.length)].map(Number)
  );
}
