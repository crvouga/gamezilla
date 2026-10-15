import type { ConnectFour } from './connect-four';
import { legalColumns } from './connect-four';

export const BOT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;
const MAX_NODES = 16_000;
const DEPTH = { easy: 1, medium: 3, hard: 6 } as const;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;
const WINDOWS = Array.from({ length: 42 }, (_, i) =>
  DIRECTIONS.flatMap(([dx, dy]) => {
    const x = (i % 7) + 3 * dx;
    const y = Math.floor(i / 7) + 3 * dy;
    return x >= 0 && x < 7 && y >= 0 && y < 6
      ? [Array.from({ length: 4 }, (_, n) => i + n * (dy * 7 + dx))]
      : [];
  })
).flat();
type Search = {
  readonly board: number[];
  readonly heights: number[];
  nodes: number;
  discs: number;
};
function evaluate(search: Search, player: number): number {
  let score = 0;
  for (let row = 0; row < 6; row++) {
    const disc = search.board[row * 7 + 3];
    if (disc !== 0) score += disc === player ? 5 : -5;
  }
  const weights = [0, 1, 8, 60, WIN];
  for (const window of WINDOWS) {
    let own = 0;
    let other = 0;
    for (const cell of window) {
      const disc = search.board[cell];
      if (disc === player) own++;
      else if (disc !== 0) other++;
    }
    if (other === 0) score += weights[own]!;
    if (own === 0) score -= weights[other]!;
  }
  return score;
}
function wins(search: Search, cell: number, player: number): boolean {
  const col = cell % 7;
  const row = Math.floor(cell / 7);
  for (const [dx, dy] of DIRECTIONS) {
    let count = 1;
    for (const sign of [-1, 1])
      for (let n = 1; n < 4; n++) {
        const x = col + n * dx * sign;
        const y = row + n * dy * sign;
        if (
          x < 0 ||
          x >= 7 ||
          y < 0 ||
          y >= 6 ||
          search.board[y * 7 + x] !== player
        )
          break;
        count++;
      }
    if (count >= 4) return true;
  }
  return false;
}
function place(search: Search, column: number, player: number): number {
  const cell = search.heights[column]! * 7 + column;
  search.board[cell] = player;
  search.heights[column] = search.heights[column]! + 1;
  search.discs++;
  return cell;
}
function undo(search: Search, column: number, cell: number): void {
  search.board[cell] = 0;
  search.heights[column] = search.heights[column]! - 1;
  search.discs--;
}
function search(
  searchState: Search,
  depth: number,
  alpha: number,
  beta: number
): number {
  const player = searchState.discs % 2 === 0 ? 1 : 2;
  searchState.nodes++;
  if (searchState.discs === 42) return 0;
  if (depth === 0 || searchState.nodes >= MAX_NODES)
    return evaluate(searchState, player);
  let best = -Infinity;
  for (const column of ORDER) {
    if (searchState.heights[column] === 6) continue;
    const cell = place(searchState, column, player);
    const score = wins(searchState, cell, player)
      ? WIN + depth
      : -search(searchState, depth - 1, -beta, -alpha);
    undo(searchState, column, cell);
    best = Math.max(best, score);
    alpha = Math.max(alpha, best);
    if (alpha >= beta) break;
  }
  return best;
}
/** Search uses a private working board; accepted game state never changes. */
export function chooseConnectFourColumn(
  game: ConnectFour,
  difficulty: BotDifficulty,
  random: () => number
): number | null {
  const legal = legalColumns(game);
  if (legal.length === 0) return null;
  if (difficulty === 'easy')
    return legal[
      Math.min(
        legal.length - 1,
        Math.max(0, Math.floor(random() * legal.length))
      )
    ]!;
  const state: Search = {
    board: [...game.board],
    heights: Array.from(
      { length: 7 },
      (_, c) => game.board.filter((disc, i) => i % 7 === c && disc !== 0).length
    ),
    nodes: 0,
    discs: game.moves.length,
  };
  let selected = legal[0]!;
  let best = -Infinity;
  for (const column of ORDER) {
    if (state.heights[column] === 6) continue;
    const cell = place(state, column, game.turn);
    const score = wins(state, cell, game.turn)
      ? WIN + DEPTH[difficulty]
      : -search(state, DEPTH[difficulty] - 1, -Infinity, -best);
    undo(state, column, cell);
    if (score > best) {
      best = score;
      selected = column;
    }
  }
  return selected;
}
