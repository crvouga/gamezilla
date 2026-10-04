/**
 * Pure chess-board perf helpers (no DOM). Clocks are injected — never call
 * `performance.now` / `Date.now` from this module.
 */

import { ChessGame } from '@pkgs/chess-board-core-shared/game';
import { isSquare } from '@pkgs/chess-board-core-shared/geometry';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import { parseUci } from '@pkgs/chess-rules-shared/uci';

/**
 * Budgets the bench page reports against.
 */
export const BOARD_PERF_BUDGETS = {
  /** Mount scripting on desktop. */
  mountScriptingMs: 5,
  /** Interaction INP ceiling. */
  inpMs: 50,
  /** No long tasks above this during scrub / flip / resize. */
  longTaskMs: 50,
} as const;

export type SyncMeasure = {
  readonly totalMs: number;
  readonly meanMs: number;
  readonly maxMs: number;
};

/** Time `fn` over `iterations` using an injected `now` (ms). */
export function measureSync(
  fn: () => void,
  iterations: number,
  now: () => number
): SyncMeasure {
  const n = Math.max(0, Math.floor(iterations));
  if (n === 0) return { totalMs: 0, meanMs: 0, maxMs: 0 };
  let totalMs = 0;
  let maxMs = 0;
  for (let i = 0; i < n; i++) {
    const t0 = now();
    fn();
    const dt = now() - t0;
    totalMs += dt;
    if (dt > maxMs) maxMs = dt;
  }
  return { totalMs, meanMs: totalMs / n, maxMs };
}

/**
 * Fixed legal opening (Italian Game). On exhausted script the game resets so
 * any `count` stays deterministic.
 */
const FIXED_UCI: readonly string[] = [
  'e2e4',
  'e7e5',
  'g1f3',
  'b8c6',
  'f1c4',
  'g8f6',
  'd2d3',
  'f8c5',
  'c2c3',
  'd7d6',
  'b1d2',
  'a7a6',
  'a2a4',
  'c8g4',
  'h2h3',
  'g4h5',
  'e1g1',
  'e8g8',
  'b2b4',
  'c5b6',
  'a4a5',
  'b6a7',
  'd1b3',
  'd8d7',
];

function tryApplyUci(game: ChessGame, uci: string): boolean {
  const parsed = parseUci(uci);
  if (parsed === null) return false;
  if (!isSquare(parsed.from) || !isSquare(parsed.to)) return false;
  const from: Square = parsed.from;
  const to: Square = parsed.to;
  const result = game.tryMove({
    from,
    to,
    ...(parsed.promotion !== undefined ? { promotion: parsed.promotion } : {}),
  });
  return result.ok;
}

/** Successive FENs from the fixed script (resets when the script ends / fails). */
export function generatePlyFens(count: number): string[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const game = new ChessGame();
  const out: string[] = [];
  let i = 0;
  while (out.length < n) {
    out.push(game.getSnapshot().fen);
    if (out.length >= n) break;
    if (i >= FIXED_UCI.length) {
      game.reset();
      i = 0;
      continue;
    }
    const uci = FIXED_UCI.at(i);
    i += 1;
    if (uci === undefined || !tryApplyUci(game, uci)) {
      game.reset();
      i = 0;
    }
  }
  return out;
}
