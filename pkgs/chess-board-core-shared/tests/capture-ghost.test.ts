import { describe, expect, test } from 'bun:test';
import { buildCaptureGhost, captureGhostForTransition, captureVictimSquare, resolveCaptureMove } from '@pkgs/chess-board-core-shared/capture-ghost';
import { positionFromChess } from '@pkgs/chess-board-core-shared/position';
import { Chess } from 'chess.js';

describe('captureVictimSquare', () => {
  test('plain capture lands on `to`; en passant is behind it', () => {
    expect(captureVictimSquare({ from: 'e4', to: 'd5' })).toBe('d5');
    expect(captureVictimSquare({ from: 'e5', to: 'd6', enPassant: true })).toBe(
      'd5'
    );
  });
});

describe('resolveCaptureMove', () => {
  test('prefers the explicit capturing last move', () => {
    const c = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const prev = positionFromChess(c);
    c.move('exd5');
    const next = positionFromChess(c);
    const explicit = { from: 'e4', to: 'd5', captured: 'p' } as const;
    expect(resolveCaptureMove(explicit, prev, next)).toBe(explicit);
  });

  test('falls back to the inferred capture, null for quiet plies', () => {
    const c = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const prev = positionFromChess(c);
    c.move('exd5');
    const next = positionFromChess(c);
    expect(resolveCaptureMove(null, prev, next)?.captured).toBe('p');

    const quiet = new Chess();
    const q0 = positionFromChess(quiet);
    quiet.move('e4');
    expect(resolveCaptureMove(null, q0, positionFromChess(quiet))).toBeNull();
  });
});

describe('buildCaptureGhost', () => {
  test('ghost is the victim colour + type on the victim square', () => {
    const c = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    c.move('exd5');
    expect(
      buildCaptureGhost(positionFromChess(c), {
        from: 'e4',
        to: 'd5',
        captured: 'p',
      })
    ).toEqual({ square: 'd5', code: 'bp' });
  });

  test('null without a capture', () => {
    const c = new Chess();
    expect(
      buildCaptureGhost(positionFromChess(c), { from: 'e2', to: 'e4' })
    ).toBeNull();
  });
});

describe('captureGhostForTransition', () => {
  test('only when animating, with a previous position, and a real change', () => {
    const c = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const prev = positionFromChess(c);
    c.move('exd5');
    const next = positionFromChess(c);
    const base = { prev, position: next, lastMove: null, animations: true };

    expect(captureGhostForTransition(base)).toEqual({
      square: 'd5',
      code: 'bp',
    });
    expect(
      captureGhostForTransition({ ...base, animations: false })
    ).toBeNull();
    expect(captureGhostForTransition({ ...base, prev: null })).toBeNull();
    expect(captureGhostForTransition({ ...base, position: prev })).toBeNull();
  });
});
