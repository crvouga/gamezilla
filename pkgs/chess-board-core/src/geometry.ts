/**
 * Board geometry: algebraic squares ↔ 0..63 indices ↔ pixel coordinates for
 * a square board of `boardPx` pixels with the given orientation.
 * Index 0 = a1, 63 = h8. Pixel space is top-left origin.
 */

import type { BoardOrientation, Square } from './types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function isSquare(v: string): v is Square {
  if (v.length !== 2) return false;
  const f = v[0] as (typeof FILES)[number];
  const r = v[1] as (typeof RANKS)[number];
  return FILES.includes(f) && RANKS.includes(r);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function indexFromSquare(square: Square): number {
  const file = square.charCodeAt(0) - 97; // 'a'
  const rank = square.charCodeAt(1) - 49; // '1'
  return rank * 8 + file;
}

export function squareFromIndex(index: number): Square {
  const i = clamp(index, 0, 63);
  const file = String.fromCharCode(97 + (i % 8));
  const rank = String.fromCharCode(49 + Math.floor(i / 8));
  return `${file}${rank}` as Square;
}

/** Canvas row/col (top-left origin) → 0-based file/rank for the orientation. */
export function toDisplayFileRank(
  orientation: BoardOrientation,
  row: number,
  col: number
): { file: number; rank: number } {
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
  if (!Number.isFinite(boardPx) || boardPx <= 0) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x >= boardPx || y >= boardPx) return null;
  const cell = boardPx / 8;
  const col = clamp(Math.floor(x / cell), 0, 7);
  const row = clamp(Math.floor(y / cell), 0, 7);
  const { file, rank } = toDisplayFileRank(orientation, row, col);
  const f = String.fromCharCode(97 + file);
  const r = String.fromCharCode(49 + rank);
  return `${f}${r}` as Square;
}

export function squareToXY(
  square: Square,
  boardPx: number,
  orientation: BoardOrientation
): { x: number; y: number; cell: number } {
  const cell = boardPx / 8;
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return { x: col * cell, y: row * cell, cell };
}

/** Geometric center of a square. */
export function squareCenter(
  square: Square,
  boardPx: number,
  orientation: BoardOrientation
): { x: number; y: number } {
  const { x, y, cell } = squareToXY(square, boardPx, orientation);
  return { x: x + cell / 2, y: y + cell / 2 };
}

/** True when from→to is a knight jump (used to auto-bend arrows). */
export function isKnightJump(from: Square, to: Square): boolean {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(from.charCodeAt(1) - to.charCodeAt(1));
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}
