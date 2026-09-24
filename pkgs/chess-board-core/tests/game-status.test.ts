import { afterEach, describe, expect, test } from 'bun:test';
import { ChessGame } from '@pkgs/chess-board-core/game';
import { assertProperty } from '@pkgs/property';
import { Chess } from 'chess.js';
import fc from 'fast-check';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

type Generator = (this: Chess, ...args: unknown[]) => unknown;

/** Counts chess.js legal-move generations (its internal `_moves`). */
function countMoveGeneration() {
  const proto = Chess.prototype as unknown as Record<string, Generator>;
  const original = proto['_moves'];
  if (original === undefined) throw new Error('chess.js has no _moves');
  const counter = { n: 0 };
  proto['_moves'] = function (this: Chess, ...args: unknown[]) {
    counter.n += 1;
    return original.apply(this, args);
  };
  return {
    counter,
    restore: () => {
      proto['_moves'] = original;
    },
  };
}

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

describe('ChessGame status', () => {
  test('every snapshot agrees with chess.js on check, mate, stalemate and draws', () => {
    assertProperty(
      'game-status',
      fc.property(
        fc.array(fc.nat(), { minLength: 1, maxLength: 120 }),
        (picks) => {
          const game = new ChessGame(START);
          const ref = new Chess(START);
          for (const pick of picks) {
            const moves = ref.moves({ verbose: true });
            if (moves.length === 0) break;
            const m = moves[pick % moves.length];
            if (m === undefined) break;
            const result = game.tryMove({
              from: m.from,
              to: m.to,
              ...(m.promotion ? { promotion: m.promotion as 'q' } : {}),
            });
            ref.move(m);
            const s = game.getSnapshot();
            expect(s.fen).toBe(ref.fen());
            expect({
              inCheck: s.inCheck,
              isCheckmate: s.isCheckmate,
              isStalemate: s.isStalemate,
              isDraw: s.isDraw,
              isGameOver: s.isGameOver,
            }).toEqual({
              inCheck: ref.inCheck(),
              isCheckmate: ref.isCheckmate(),
              isStalemate: ref.isStalemate(),
              isDraw: ref.isDraw(),
              isGameOver: ref.isGameOver(),
            });
            expect(result.ok && result.isCheckmate).toBe(ref.isCheckmate());
          }
        }
      )
    );
  });

  test('an external position costs at most one legal-move generation', () => {
    const game = new ChessGame(START);
    const spy = countMoveGeneration();
    restore = spy.restore;
    game.applyExternalFen(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    );
    expect(spy.counter.n).toBeLessThanOrEqual(1);
  });

  test('clearing the last-move highlight recomputes nothing', () => {
    const game = new ChessGame(START);
    game.tryMove({ from: 'e2', to: 'e4' });
    const before = game.getSnapshot();
    const spy = countMoveGeneration();
    restore = spy.restore;
    game.clearLastMove();
    expect(spy.counter.n).toBe(0);
    const after = game.getSnapshot();
    expect(after.lastMove).toBeNull();
    expect(after.position).toBe(before.position);
    expect(after.fen).toBe(before.fen);
  });
});
