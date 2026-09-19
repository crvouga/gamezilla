/**
 * Reference chess rules (chess.js, independent of the board's own game
 * object) plus fixture positions and a seeded PRNG for model-based runs.
 */

import type { Square } from '@pkgs/chess-board-core/types';
import { Chess, type Move as ChessJsMove } from 'chess.js';

export const FEN = {
  start: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  /** Both white castles available (b1–d1, f1–g1 empty). */
  castle: 'r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1',
  /** exf6 en passant. */
  enPassant: 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',
  /** a7-a8 promotes; a7xb8 promotes with capture. */
  whitePromotion: '1n5k/P7/8/8/8/8/8/6K1 w - - 0 1',
  /** a2-a1 promotes; a2xb1 promotes with capture. */
  blackPromotion: '6k1/8/8/8/8/8/p7/1N4K1 b - - 0 1',
  /** Qf3xf7 is mate. */
  mateInOne:
    'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  /** Qf6-f7 stalemates. */
  stalemateInOne: '7k/8/5QK1/8/8/8/8/8 w - - 0 1',
  /** Qd1-h5 is check (not mate); black's only answer is g7-g6. */
  checkInOne: 'rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  /** White f2 pawn is pinned by Qh4. */
  pinned: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/3P4/PPP2PPP/RNBQKBNR w KQkq - 1 3',
  /** Black to move in the Italian: plenty of pieces for both colors. */
  middlegame:
    'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5',
} as const;

export const ALL_SQUARES: readonly Square[] = 'abcdefgh'
  .split('')
  .flatMap((f) => '12345678'.split('').map((r) => `${f}${r}` as Square));

function verboseMoves(fen: string, square?: Square): ChessJsMove[] {
  const chess = new Chess(fen);
  return square === undefined
    ? chess.moves({ verbose: true })
    : chess.moves({ square, verbose: true });
}

/** Sorted distinct legal destinations of the piece on `square`. */
export function legalTargets(fen: string, square: Square): readonly Square[] {
  return [...new Set(verboseMoves(fen, square).map((m) => m.to))].sort();
}

/** FEN after playing `uci` (e.g. `e2e4`, `a7a8q`) from `fen`. */
export function play(fen: string, ...ucis: readonly string[]): string {
  const chess = new Chess(fen);
  for (const uci of ucis) {
    chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci.slice(4) } : {}),
    });
  }
  return chess.fen();
}

export type OracleMove = {
  readonly from: Square;
  readonly to: Square;
  readonly promotion: 'q' | 'r' | 'b' | 'n' | undefined;
};

export function allLegalMoves(fen: string): readonly OracleMove[] {
  return verboseMoves(fen).map((m) => ({
    from: m.from,
    to: m.to,
    promotion: m.promotion as OracleMove['promotion'],
  }));
}

export function turnOf(fen: string): 'w' | 'b' {
  return new Chess(fen).turn();
}

export function isGameOver(fen: string): boolean {
  return new Chess(fen).isGameOver();
}

export function pieceAt(fen: string, square: Square): string | null {
  const p = new Chess(fen).get(square);
  return p === undefined ? null : `${p.color}${p.type}`;
}

/** Deterministic PRNG (mulberry32) so a failing model-based run replays. */
export function createRng(seed: number): {
  readonly next: () => number;
  readonly int: (maxExclusive: number) => number;
  readonly pick: <T>(items: readonly T[]) => T;
} {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number): number =>
    Math.floor(next() * maxExclusive);
  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      const item = items[int(items.length)];
      if (item === undefined) throw new Error('rng.pick: empty list');
      return item;
    },
  };
}
