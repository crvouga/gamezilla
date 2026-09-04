/**
 * Documented ids / UCI for {@link ../setup/seed-sim-chess-puzzles} fixture
 * (`product/test/fixtures/chess-puzzles.sim.csv`). Ratings sit near the default
 * feed center (~1200). First UCI token is the opponent ply (see puzzle FSM).
 */

export type SimChessPuzzle = {
  readonly id: string;
  readonly rating: number;
  /** Full Lichess moves line (opponent + human plies). */
  readonly moves: string;
  /** Human UCI tokens only (skip the leading opponent ply). */
  readonly humanUci: readonly string[];
};

/** Mate-in-1 (one human ply after opponent). */
export const SIM_CHESS_PUZZLE_MATE_IN_1: SimChessPuzzle = {
  id: '007hv',
  rating: 1275,
  moves: 'd2c3 d4g1',
  humanUci: ['d4g1'],
};

/** Second mate-in-1 for Next / progression. */
export const SIM_CHESS_PUZZLE_MATE_IN_1_B: SimChessPuzzle = {
  id: '01zsb',
  rating: 1220,
  moves: 'c1d1 g6g2',
  humanUci: ['g6g2'],
};

/** Mate-in-2 (two human plies) for multi-move progress. */
export const SIM_CHESS_PUZZLE_MATE_IN_2: SimChessPuzzle = {
  id: '01Xbe',
  rating: 1190,
  moves: 'g3h4 g6g5 h4g3 a2g2',
  humanUci: ['g6g5', 'a2g2'],
};

export const SIM_CHESS_PUZZLES: readonly SimChessPuzzle[] = [
  SIM_CHESS_PUZZLE_MATE_IN_1,
  SIM_CHESS_PUZZLE_MATE_IN_1_B,
  SIM_CHESS_PUZZLE_MATE_IN_2,
];

export const SIM_CHESS_PUZZLE_IDS: readonly string[] = SIM_CHESS_PUZZLES.map(
  (p) => p.id
);
