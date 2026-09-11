import { describe, expect, test } from 'bun:test';
import { ChessGame } from '@pkgs/chess-board-core/game';
import { atomicExplosionSquares } from '@pkgs/chess-board-core/variants/atomic-explode';
import {
  castleDropTargets,
  normalizeCastleDrop,
} from '@pkgs/chess-board-core/variants/castling-dests';

describe('castleDropTargets', () => {
  test('includes king landing and rook square', () => {
    const leg = {
      kingFrom: 'e1' as const,
      kingTo: 'g1' as const,
      rookFrom: 'h1' as const,
      rookTo: 'f1' as const,
    };
    expect([...castleDropTargets(leg)].sort()).toEqual(['g1', 'h1']);
    expect(normalizeCastleDrop(leg, 'h1')).toBe('g1');
    expect(normalizeCastleDrop(leg, 'g1')).toBe('g1');
    expect(normalizeCastleDrop(leg, 'f1')).toBeNull();
  });
});

describe('atomicExplosionSquares', () => {
  test('includes capture square and adjacent non-pawns', () => {
    const game = new ChessGame();
    const pos = game.getSnapshot().position;
    const sqs = atomicExplosionSquares(pos, 'e4');
    expect(sqs[0]).toBe('e4');
  });
});
