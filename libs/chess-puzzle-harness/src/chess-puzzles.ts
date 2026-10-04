/**
 * Documented ids / UCI for {@link ../setup/seed-harness-chess-puzzles} fixture
 * (`libs/chess-puzzle-harness/fixtures/chess-puzzles.harness.csv`). Ratings sit near the default
 * feed center (~1200). First UCI token is the opponent ply (see puzzle FSM).
 */

export type HarnessChessPuzzle = {
  readonly id: string;
  readonly rating: number;
  /** Full Lichess moves line (opponent + human plies). */
  readonly moves: string;
  /** Human UCI tokens only (skip the leading opponent ply). */
  readonly humanUci: readonly string[];
};

/** Mate-in-1 (one human ply after opponent). */
export const HARNESS_CHESS_PUZZLE_MATE_IN_1: HarnessChessPuzzle = {
  id: '007hv',
  rating: 1275,
  moves: 'd2c3 d4g1',
  humanUci: ['d4g1'],
};

/** Second mate-in-1 for Next / progression. */
export const HARNESS_CHESS_PUZZLE_MATE_IN_1_B: HarnessChessPuzzle = {
  id: '01zsb',
  rating: 1220,
  moves: 'c1d1 g6g2',
  humanUci: ['g6g2'],
};

/** Mate-in-2 (two human plies) for multi-move progress. */
export const HARNESS_CHESS_PUZZLE_MATE_IN_2: HarnessChessPuzzle = {
  id: '01Xbe',
  rating: 1190,
  moves: 'g3h4 g6g5 h4g3 a2g2',
  humanUci: ['g6g5', 'a2g2'],
};

export const HARNESS_CHESS_PUZZLES: readonly HarnessChessPuzzle[] = [
  HARNESS_CHESS_PUZZLE_MATE_IN_1,
  HARNESS_CHESS_PUZZLE_MATE_IN_1_B,
  HARNESS_CHESS_PUZZLE_MATE_IN_2,
];

export const HARNESS_CHESS_PUZZLE_IDS: readonly string[] =
  HARNESS_CHESS_PUZZLES.map((p) => p.id);

/**
 * The chess puzzle CSV fixtures (`libs/chess-puzzle-harness/fixtures/*.harness.csv`). Node-only:
 * under a browser bundle there is no module directory.
 */
export const HARNESS_CHESS_FIXTURES_DIR = `${import.meta.dirname}/../fixtures`;
