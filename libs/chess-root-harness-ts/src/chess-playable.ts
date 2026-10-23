import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import type { PlayableGame } from '@libs/game-session-harness-ts/harness-game';
import type { PuzzleFixture } from '@libs/game-session-harness-ts/known-puzzles';
import { CUSTOM_GAME_MATERIAL } from './custom-game-histories';

/** Chess's game id, as the space's game choice and finding an opponent name it. */
export const CHESS_GAME_ID = chessGameShared.id;

const ROOK_FILES = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
const ROOK_RANKS = [1, 2, 3, 4, 5] as const;

/**
 * More chess puzzles than the known three, from the laws of chess (FIDE):
 * Black's king on g8 steps to h8 beside White's king on g6, and White's
 * rook, anywhere on the a- to f-files below the sixth rank, mates on the
 * eighth (g7 and h7 are the king's, g8 the rook's). Kf6 is legal and no
 * mate; a king cannot move two squares; Black cannot move on White's turn.
 */
function moreChessPuzzles(): PuzzleFixture[] {
  return ROOK_FILES.flatMap((file, column) =>
    ROOK_RANKS.map((rank, row) => {
      const rookRow = `${column === 0 ? '' : String(column)}R${String(7 - column)}`;
      const rows = [5, 4, 3, 2, 1].map((r) => (r === rank ? rookRow : '8'));
      return {
        record: {
          id: `KRm${file}${String(rank)}`,
          position: `6k1/8/6K1/${rows.join('/')} b - - 0 1`,
          line: ['g8h8', `${file}${String(rank)}${file}8`],
          rating: 1300 + (column * 5 + row) * 10,
          ratingDeviation: 80,
          popularity: 90,
          plays: 100,
          themes: ['endgame', 'mate', 'mateIn1', 'oneMove'],
        },
        solverSide: 'white' as const,
        solution: [`${file}${String(rank)}${file}8`],
        labels: ['Kh8', `R${file}8#`],
        wrongMove: { at: 1, action: 'g6f6' },
        refusedMove: { at: 1, action: 'g6g8' },
        opponentMove: { at: 1, action: 'h8g8' },
      };
    })
  );
}

/** Chess as any driver plays it, without its screens. */
export const CHESS_PLAYABLE: PlayableGame<
  (typeof chessGameShared)['capabilities']
> = {
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
    // Known puzzles, each from the laws of chess (FIDE); the platform's
    // judge, playback and session are held to them.
    puzzles: [
      {
        // Lichess puzzle 01Xbe: after Kh4, g5+ Kg3 Rg2# mates in two. Ra1
        // instead of the mate is a legal rook move that neither follows the
        // line nor mates; a pawn on g6 cannot advance two squares.
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
        solverSide: 'black',
        solution: ['g6g5', 'a2g2'],
        labels: ['Kh4', 'g5+', 'Kg3', 'Rg2#'],
        wrongMove: { at: 3, action: 'a2a1' },
        refusedMove: { at: 1, action: 'g6g4' },
        // Black is to move: White's rook cannot be moved.
        opponentMove: { at: 1, action: 'd7d8' },
      },
      {
        // Two rooks to the fifth rank, the a-rook first: either rook may
        // go first, and the pair meets the same position after h6. Ke2
        // follows neither; the a-rook cannot pass the pawn on a6.
        record: {
          id: 'TwoRk',
          position: '6k1/p6p/8/8/8/8/8/R3K2R b - - 0 1',
          line: ['a7a6', 'a1a5', 'h7h6', 'h1h5'],
          // Below a new solver's 1500, as every known puzzle is: a wrong
          // move's half credit then still lowers their rating. This one
          // and the ladder are within 100 of it, so a settled 1500 has a
          // next puzzle in its rating window after solving one.
          rating: 1450,
          ratingDeviation: 80,
          popularity: 90,
          plays: 100,
          themes: ['endgame', 'short'],
        },
        solverSide: 'white',
        solution: ['a1a5', 'h1h5'],
        // Both rooks reach h5 by then, so the h-rook is named by its file.
        labels: ['a6', 'Ra5', 'h6', 'Rhh5'],
        wrongMove: { at: 1, action: 'e1e2' },
        refusedMove: { at: 1, action: 'a1a8' },
        // White is to move: Black's king cannot be moved.
        opponentMove: { at: 1, action: 'g8f8' },
        transposition: { at: 1, action: 'h1h5' },
      },
      {
        // The rook ladder: after a4 the line plays Rc7 and, after a3, Rc8#;
        // Rb8# mates at once (the a-rook holds the seventh rank). Kf2 is
        // no mate; a king cannot move two squares.
        record: {
          id: 'Laddr',
          position: '7k/RR6/8/p7/8/8/8/6K1 b - - 0 1',
          line: ['a5a4', 'b7c7', 'a4a3', 'c7c8'],
          rating: 1450,
          ratingDeviation: 80,
          popularity: 90,
          plays: 100,
          themes: ['endgame', 'mate', 'mateIn2', 'short'],
        },
        solverSide: 'white',
        solution: ['b7c7', 'c7c8'],
        labels: ['a4', 'Rc7', 'a3', 'Rc8#'],
        wrongMove: { at: 1, action: 'g1f2' },
        refusedMove: { at: 1, action: 'g1g3' },
        // White is to move: Black's king cannot be moved.
        opponentMove: { at: 1, action: 'h8g8' },
        wonAnotherWay: { at: 1, action: 'b7b8' },
      },
    ],
    morePuzzles: moreChessPuzzles(),
  },
};
