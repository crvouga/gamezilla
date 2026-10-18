import { chessGameShared } from '@libs/chess-sub-shared/chess-game';
import type { PlayableGame } from '@libs/game-session-harness/harness-game';
import { CUSTOM_GAME_MATERIAL } from './custom-game-histories';

/** Chess's game id, as the space's game choice and finding an opponent name it. */
export const CHESS_GAME_ID = chessGameShared.id;

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
    // Lichess puzzle 01Xbe: after Kh4, g5+ Kg3 Rg2# mates in two; Ra1 is
    // a legal rook move that neither follows the line nor mates.
    puzzle: {
      record: {
        id: '01Xbe',
        position: '8/3R3p/6pk/3p4/2p1b1P1/6KP/r7/4R3 w - - 0 41',
        line: ['g3h4', 'g6g5', 'h4g3', 'a2g2'],
        rating: 1190,
        ratingDeviation: 76,
        popularity: 100,
        plays: 220,
        themes: ['endgame', 'mate', 'mateIn2', 'short'],
      },
      wrongAction: 'a2a1',
    },
  },
};
