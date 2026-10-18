import { CUSTOM_GAME_MATERIAL } from '@libs/chess-custom-game-harness/custom-game-histories';
import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import type { PlayableGame } from '@libs/game-session-harness/harness-game';

/** Chess as any driver plays it, without its screens. */
export const CHESS_PLAYABLE: PlayableGame = {
  label: 'chess',
  shared: chessGameShared,
  fixtures: {
    // Scholar's mate: White mates on f7 with the seventh move.
    firstSideVictory: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'],
    // The same moves in algebraic notation (FIDE Appendix C).
    firstSideVictoryLabels: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'],
    // A pawn cannot advance three squares, a knight cannot move straight, a
    // black pawn cannot move first, and a square is not a move.
    refusedOpenings: ['e2e5', 'g1g3', 'e7e5', 'e2'],
    // White's king and queen against Black's bare king, which can never
    // mate (FIDE 6.9); White's last move, Qh6-f6, keeps it so.
    secondSideCannotWin: CUSTOM_GAME_MATERIAL.slice(0, 53),
    // Both knights out and home twice: the starting position stands for the
    // third time, with White to move, which draws by repetition (FIDE 9.2).
    drawByRules: [
      'g1f3',
      'g8f6',
      'f3g1',
      'f6g8',
      'g1f3',
      'g8f6',
      'f3g1',
      'f6g8',
    ],
  },
};
