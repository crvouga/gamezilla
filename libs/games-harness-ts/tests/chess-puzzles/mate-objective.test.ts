import { expect, test } from 'bun:test';
import { judgePuzzleAction } from '@libs/game-puzzle-shared-ts/puzzle-judge';
import { sideToMoveOf } from '@pkgs/chess-rules-shared-ts/fen';
import { CHESS_PUZZLE_GAME } from './chess-puzzle-game';

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

// regression: puzzle-stored-mate-continues
test('checkmate ends play even when contradictory data expects another reply', () => {
  const result = judgePuzzleMove({
    fen: '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2',
    tokens: ['a5a4', 'b7b8', 'a4a3', 'b8c8'],
    idx: 1,
    uci: 'b7b8',
  });
  expect(result).toMatchObject({ kind: 'correct', ends: true });
  expect(result.kind === 'correct' && result.line).toEqual(['a5a4', 'b7b8']);
});
