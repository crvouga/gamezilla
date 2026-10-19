import { expect, test } from 'bun:test';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import { sideToMoveOf } from '@pkgs/chess-rules-shared/fen';
import { Chess } from 'chess.js';
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

test('two hundred identical ladder positions accept every mate', () => {
  // regression: mate-oracle-rebuilds-every-candidate
  const fen = '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2';
  for (let example = 0; example < 200; example += 1) {
    const oracle = new Chess(fen);
    let mates = 0;
    for (const candidate of oracle.moves({ verbose: true })) {
      oracle.move(candidate);
      const checkmate = oracle.isCheckmate();
      oracle.undo();
      if (!checkmate) continue;
      mates += 1;
      expect(
        judgePuzzleMove({
          fen,
          tokens: ['a2a3', 'b7b8'],
          idx: 1,
          uci: candidate.lan,
        })
      ).toMatchObject({ kind: 'correct', ends: true });
    }
    expect(mates).toBeGreaterThan(1);
  }
});
