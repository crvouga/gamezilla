import { expect, test } from 'bun:test';
import {
  hangingPieces,
  knightForks,
} from '@pkgs/chess-rules-shared-ts/tactics';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { Chess } from 'chess.js';
import fc from 'fast-check';
import { tacticalPosition } from './tactical-positions';

const POSITIONS = [
  '4k3/8/8/8/3r4/8/3N4/7K b - - 1 2',
  '4k3/8/8/8/3r4/8/3N4/2B4K b - - 1 2',
  '4k3/8/8/5n2/8/7P/8/3Q1K2 b - - 0 2',
  '4k3/4n3/8/8/8/8/3Q4/4R1K1 b - - 0 1',
] as const;

const position = fc.oneof(fc.constantFrom(...POSITIONS), tacticalPosition);

test('every hanging-piece claim has a legal capture and no legal recapture', () => {
  assertProperty(
    'hanging pieces have canonical legal capture evidence',
    fc.property(position, fc.integer({ min: 0, max: 12 }), (fen, quiet) => {
      const fields = fen.split(' ');
      fields[4] = String(quiet);
      const input = fields.join(' ');
      for (const claim of hangingPieces(input)) {
        const oracle = new Chess(input);
        const move = oracle
          .moves({ verbose: true })
          .find((candidate) => candidate.lan === claim.capture);
        expect(move).toBeDefined();
        expect(move?.captured).toBe(claim.piece);
        oracle.move(move!);
        expect(
          oracle
            .moves({ verbose: true })
            .some(
              (reply) => reply.to === move!.to && reply.captured !== undefined
            )
        ).toBe(false);
      }
    })
  );
});

test('knight forks name legal threats to at least two valuable opposing pieces', () => {
  assertProperty(
    'knight forks have canonical legal evidence',
    fc.property(position, (fen) => {
      for (const claim of knightForks(fen)) {
        const oracle = new Chess(fen);
        const played = oracle.move(claim.move);
        expect(played.piece).toBe('n');
        expect(claim.targets.length).toBeGreaterThanOrEqual(2);
        for (const target of claim.targets) {
          expect(oracle.get(target.square)?.type).toBe(target.piece);
          expect(oracle.attackers(target.square, played.color)).toContain(
            claim.square
          );
        }
      }
    })
  );
});

test('every piece with a legal unanswerable capture is reported', () => {
  assertProperty(
    'no supported hanging piece is omitted',
    fc.property(position, (fen) => {
      const oracle = new Chess(fen);
      const expected = new Set<string>();
      for (const move of oracle.moves({ verbose: true })) {
        if (move.captured === undefined) continue;
        const after = new Chess(fen);
        after.move(move);
        if (
          after
            .moves({ verbose: true })
            .some(
              (reply) => reply.to === move.to && reply.captured !== undefined
            )
        )
          continue;
        expected.add(
          move.isEnPassant() ? `${move.to[0]}${move.from[1]}` : move.to
        );
      }
      expect(
        new Set<string>(hangingPieces(fen).map((claim) => claim.square))
      ).toEqual(expected);
    }),
    { numRuns: 100 }
  );
});

function forkMoves(fen: string): ReadonlySet<string> {
  const board = new Chess(fen);
  const result = new Set<string>();
  for (const move of board.moves({ verbose: true })) {
    if (move.piece !== 'n') continue;
    const after = new Chess(fen);
    after.move(move);
    const fields = after.fen().split(' ');
    fields[1] = move.color;
    const captures = new Chess(fields.join(' ')).moves({
      square: move.to,
      verbose: true,
    });
    const targets = after
      .board()
      .flat()
      .filter((piece) => {
        if (
          piece === null ||
          piece.color === move.color ||
          !['k', 'q', 'r'].includes(piece.type)
        )
          return false;
        const file = Math.abs(
          piece.square.charCodeAt(0) - move.to.charCodeAt(0)
        );
        const rank = Math.abs(Number(piece.square[1]) - Number(move.to[1]));
        if (!((file === 1 && rank === 2) || (file === 2 && rank === 1)))
          return false;
        return (
          piece.type === 'k' ||
          captures.some((capture) => capture.to === piece.square)
        );
      });
    if (targets.length >= 2) result.add(move.lan);
  }
  return result;
}

test('every legal knight fork of valuable opposing pieces is reported', () => {
  assertProperty(
    'supported knight forks are neither invented nor omitted',
    fc.property(position, (fen) => {
      expect(new Set(knightForks(fen).map((claim) => claim.move))).toEqual(
        new Set(forkMoves(fen))
      );
    }),
    { numRuns: 100 }
  );
});
