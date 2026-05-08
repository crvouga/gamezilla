import type { BoardOrientation, Square } from './chess-board-types';

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function isSquare(v: string): v is Square {
  if (v.length !== 2) return false;
  const f = v[0] as (typeof files)[number];
  const r = v[1] as (typeof ranks)[number];
  return files.includes(f) && ranks.includes(r);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function indexFromSquare(square: Square): number {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = square.charCodeAt(1) - '1'.charCodeAt(0);
  // index 0 = a1, 63 = h8
  return rank * 8 + file;
}

export function squareFromIndex(index: number): Square {
  const i = clamp(index, 0, 63);
  const file = files[i % 8]!;
  const rank = ranks[Math.floor(i / 8)]!;
  return `${file}${rank}` as Square;
}

export function toDisplayFileRank(
  orientation: BoardOrientation,
  row: number,
  col: number
): { file: number; rank: number } {
  // row/col are 0..7 in canvas coordinate space (top-left origin).
  // rank 8 at top if white orientation; rank 1 at top if black orientation.
  if (orientation === 'white') {
    return { file: col, rank: 7 - row };
  }
  return { file: 7 - col, rank: row };
}

export function xyToSquare(
  x: number,
  y: number,
  boardPx: number,
  orientation: BoardOrientation
): Square | null {
  if (boardPx <= 0) return null;
  if (x < 0 || y < 0 || x >= boardPx || y >= boardPx) return null;
  const cell = boardPx / 8;
  const col = clamp(Math.floor(x / cell), 0, 7);
  const row = clamp(Math.floor(y / cell), 0, 7);
  const { file, rank } = toDisplayFileRank(orientation, row, col);
  const f = files[file]!;
  const r = ranks[rank]!;
  return `${f}${r}` as Square;
}

export function squareToXY(
  square: Square,
  boardPx: number,
  orientation: BoardOrientation
): { x: number; y: number; cell: number } {
  const cell = boardPx / 8;
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = square.charCodeAt(1) - '1'.charCodeAt(0);

  let col: number;
  let row: number;
  if (orientation === 'white') {
    col = file;
    row = 7 - rank;
  } else {
    col = 7 - file;
    row = rank;
  }
  return { x: col * cell, y: row * cell, cell };
}

