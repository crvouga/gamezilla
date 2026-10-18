import { expect, test } from 'bun:test';
import { CHESS_PUZZLE_GAME } from '@libs/chess-puzzle-shared/chess-puzzles';
import { judgePuzzleAction } from '@libs/game-puzzle-shared/puzzle-judge';
import { sideToMoveOf } from '@pkgs/chess-rules-shared/fen';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { Chess, type Square } from 'chess.js';
import fc from 'fast-check';

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

const MATES = [
  '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2',
  '6k1/5pP1/p3N3/8/8/8/8/1K5R w - - 0 2',
  '7k/8/5KQ1/8/8/8/8/8 w - - 0 1',
] as const;

const ladder = fc
  .tuple(
    fc.uniqueArray(fc.integer({ min: 0, max: 5 }), {
      minLength: 2,
      maxLength: 2,
    }),
    fc.integer({ min: 0, max: 7 })
  )
  .map(([files, kingFile]) => {
    const board = new Chess();
    board.clear();
    board.put({ type: 'k', color: 'b' }, 'h8');
    board.put(
      { type: 'k', color: 'w' },
      `${String.fromCharCode(97 + kingFile)}1` as Square
    );
    for (const file of files)
      board.put(
        { type: 'r', color: 'w' },
        `${String.fromCharCode(97 + file)}7` as Square
      );
    return board.fen();
  });

function transform(fen: string, flip: boolean, black: boolean): string {
  const source = new Chess(fen);
  const output = new Chess();
  output.clear();
  for (const row of source.board())
    for (const piece of row) {
      if (piece === null) continue;
      const file = piece.square.charCodeAt(0) - 97;
      const rank = Number(piece.square[1]);
      const square =
        `${String.fromCharCode(97 + (flip ? 7 - file : file))}${black ? 9 - rank : rank}` as Square;
      output.put(
        {
          type: piece.type,
          color: black ? (piece.color === 'w' ? 'b' : 'w') : piece.color,
        },
        square
      );
    }
  const fields = output.fen().split(' ');
  fields[1] = black ? 'b' : 'w';
  return fields.join(' ');
}

const legalMates = fc.property(
  fc.oneof(fc.constantFrom(...MATES), ladder),
  fc.boolean(),
  fc.boolean(),
  fc.nat(500),
  (seed, flip, black, preferred) => {
    const fen = transform(seed, flip, black);
    const position = new Chess(fen);
    const candidates = position.moves({ verbose: true });
    const oracle = new Chess(fen);
    let mates = 0;
    for (const candidate of candidates) {
      oracle.move(candidate);
      const checkmate = oracle.isCheckmate();
      oracle.undo();
      if (!checkmate) continue;
      mates += 1;
      const stored = candidates[preferred % candidates.length]!.lan;
      for (const tokens of [
        [],
        ['a2a3', stored],
        ['a2a3', candidate.lan, 'a4a3', stored],
      ]) {
        const actual = judgePuzzleMove({
          fen,
          tokens,
          idx: 1,
          uci: candidate.lan,
        });
        expect(actual).toMatchObject({ kind: 'correct', ends: true });
        if (actual.kind === 'correct')
          expect(actual.line.at(-1)).toBe(candidate.lan);
      }
    }
    expect(mates).toBeGreaterThan(0);
    if (seed === MATES[0]) expect(mates).toBeGreaterThan(1);
  }
);

test('every legal mate succeeds regardless of preferred line and move order', () => {
  assertProperty(
    'every legal mate succeeds regardless of preferred line',
    legalMates
  );
});
