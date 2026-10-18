import { describe, expect, test } from 'bun:test';

import { CHESS_PUZZLE_GAME } from '@libs/chess-puzzle-shared/chess-puzzles';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import { sideToMoveOf } from '@pkgs/chess-rules-shared/fen';

/** The platform's judge over chess, as the solver to move in `fen`. */
function judgePuzzleMove(args: {
  fen: string;
  tokens: readonly string[];
  idx: number;
  uci: string;
}) {
  return judgePuzzleAction({
    game: CHESS_PUZZLE_GAME,
    position: args.fen,
    line: args.tokens,
    idx: args.idx,
    solverSide: sideToMoveOf(args.fen) === 'w' ? 'white' : 'black',
    action: args.uci,
  });
}

/** Position after the opponent's setup move a7a6 in the transposition puzzle. */
const TWO_ROOKS = '6k1/7p/p7/8/8/8/8/R3K2R w - - 0 2';
const TWO_ROOKS_LINE = ['a7a6', 'a1a5', 'h7h6', 'h1h5'] as const;

/** Position after a5a4: White mates with either rook on the 8th rank. */
const LADDER = '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2';

function judge(args: {
  fen: string;
  tokens: readonly string[];
  idx: number;
  uci: string;
}) {
  return judgePuzzleMove(args);
}

describe('the platform judge over chess', () => {
  test('the expected move is correct and ends the puzzle on the last ply', () => {
    const mid = judge({
      fen: TWO_ROOKS,
      tokens: [...TWO_ROOKS_LINE],
      idx: 1,
      uci: 'a1a5',
    });
    expect(mid).toMatchObject({ kind: 'correct', via: 'line', ends: false });

    const last = judge({
      fen: LADDER,
      tokens: ['a5a4', 'b7b8'],
      idx: 1,
      uci: 'b7b8',
    });
    expect(last).toMatchObject({ kind: 'correct', via: 'win', ends: true });
  });

  test('castling is compared in canonical form, king-onto-rook included', () => {
    const fen = '4k3/8/p7/8/8/8/8/4K2R w K - 0 2';
    for (const uci of ['e1g1', 'e1h1']) {
      expect(
        judge({ fen, tokens: ['a7a6', 'e1g1'], idx: 1, uci })
      ).toMatchObject({ kind: 'correct', via: 'line', action: 'e1g1' });
    }
  });

  test('the promotion piece has to match — a queen for a knight is wrong', () => {
    const fen = '8/2q1P1k1/8/8/8/8/8/6K1 w - - 0 2';
    const tokens = ['c8c7', 'e7e8n'];
    expect(judge({ fen, tokens, idx: 1, uci: 'e7e8n' })).toMatchObject({
      kind: 'correct',
      via: 'line',
    });
    expect(judge({ fen, tokens, idx: 1, uci: 'e7e8q' })).toMatchObject({
      kind: 'wrong',
      action: 'e7e8q',
    });
  });

  test('any mate is correct: on the last ply and earlier in the line', () => {
    const final = judge({
      fen: LADDER,
      tokens: ['a5a4', 'b7b8'],
      idx: 1,
      uci: 'a7a8',
    });
    expect(final).toMatchObject({ kind: 'correct', via: 'win', ends: true });

    // A faster mate than the stored four-ply line ends the puzzle at once.
    const faster = judge({
      fen: LADDER,
      tokens: ['a5a4', 'b7c7', 'a4a3', 'c7c8'],
      idx: 1,
      uci: 'b7b8',
    });
    expect(faster).toMatchObject({ kind: 'correct', via: 'win', ends: true });
    expect(faster.kind === 'correct' && faster.line).toEqual(['a5a4', 'b7b8']);
  });

  test('a transposing move is accepted and reorders the line', () => {
    const result = judge({
      fen: TWO_ROOKS,
      tokens: [...TWO_ROOKS_LINE],
      idx: 1,
      uci: 'h1h5',
    });
    expect(result).toMatchObject({
      kind: 'correct',
      via: 'transposition',
      ends: false,
    });
    expect(result.kind === 'correct' && result.line).toEqual([
      'a7a6',
      'h1h5',
      'h7h6',
      'a1a5',
    ]);
  });

  test('a legal move that is none of those is wrong; an illegal one is no move', () => {
    expect(
      judge({
        fen: TWO_ROOKS,
        tokens: [...TWO_ROOKS_LINE],
        idx: 1,
        uci: 'e1e2',
      })
    ).toMatchObject({ kind: 'wrong', label: 'Ke2' });
    // a1a8 is blocked by the pawn on a6.
    expect(
      judge({
        fen: TWO_ROOKS,
        tokens: [...TWO_ROOKS_LINE],
        idx: 1,
        uci: 'a1a8',
      })
    ).toEqual({ kind: 'illegal' });
    expect(
      judge({
        fen: TWO_ROOKS,
        tokens: [...TWO_ROOKS_LINE],
        idx: 1,
        uci: 'zz99',
      })
    ).toEqual({ kind: 'illegal' });
  });
});
