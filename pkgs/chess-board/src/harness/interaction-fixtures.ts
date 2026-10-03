import type { ExampleConfig } from './example-config';

export type Side = 'White' | 'Black';
export type PieceName =
  | 'pawn'
  | 'knight'
  | 'bishop'
  | 'rook'
  | 'queen'
  | 'king';
export type PromotionName = 'queen' | 'rook' | 'bishop' | 'knight';
export const MOVABLE: Readonly<Record<PieceName, string>> = {
  pawn: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
  knight: '4k3/7p/8/8/8/8/P7/4K1N1 w - - 0 1',
  bishop: '4k3/7p/8/8/2B5/8/P7/4K3 w - - 0 1',
  rook: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
  queen: '4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
  king: '4k3/7p/8/8/8/8/P7/4K3 w - - 0 1',
};
export const AFTER_WHITE_MOVE =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
export const AFTER_BLACK_REPLY =
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
export const PINNED_KNIGHT = 'k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1';
export const ROOK_CHECK = 'k3r3/8/8/8/8/8/R7/4K3 w - - 0 1';
export const CHECK_IN_ONE = '4k3/8/8/8/8/8/R7/K7 w - - 0 1';
export const MATE_IN_ONE = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
export const MATING_CAPTURE = '7k/6r1/5KQ1/8/8/8/8/8 w - - 0 1';
export const STALEMATE_IN_ONE = '7k/5K2/8/5Q2/8/8/8/8 w - - 0 1';
export const CHECKMATED = '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1';
export const STALEMATED = '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1';
export const EN_PASSANT = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
export const EXPIRED_EN_PASSANT = '4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1';
export const WHITE_PROMOTION = '4k3/P7/8/8/8/8/8/4K2R w - - 0 1';
export const BLACK_CAPTURE_PROMOTION = '4k3/8/8/8/8/8/1p5P/R3K3 b - - 0 1';
export const CASTLE_ACROSS_CHECK = 'k4r2/8/8/8/8/8/8/4K2R w K - 0 1';
export function castlingConfig(side: Side): ExampleConfig {
  return {
    fen: `r3k2r/8/8/8/8/8/8/R3K2R ${side === 'White' ? 'w' : 'b'} KQkq - 0 1`,
  };
}
