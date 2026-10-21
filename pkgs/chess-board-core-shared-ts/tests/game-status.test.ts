import { afterEach, describe, expect, test } from 'bun:test';
import { ChessGame } from '@pkgs/chess-board-core-shared-ts/game';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
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
              isDraw: ref.isDraw() && !ref.isCheckmate(),
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

type Uci = `${string}${string}`;

/** Plays UCI moves on `game`; returns whether the game is drawn after each. */
function drawnAfterEach(game: ChessGame, ucis: readonly Uci[]): boolean[] {
  return ucis.map((uci) => {
    const result = game.tryMove({
      from: uci.slice(0, 2) as 'a1',
      to: uci.slice(2, 4) as 'a1',
    });
    expect(result.ok).toBe(true);
    return game.getSnapshot().isDraw;
  });
}

function firstDrawnPly(game: ChessGame, ucis: readonly Uci[]): number {
  return drawnAfterEach(game, ucis).indexOf(true) + 1;
}

/**
 * Trips that end where they began. Alternating two different trips repeats
 * only the home position, never a position on the way.
 */
const KNIGHTS_VIA_F3 = ['g1f3', 'b8c6', 'f3g1', 'c6b8'] as const;
const KNIGHTS_VIA_H3 = ['g1h3', 'b8a6', 'h3g1', 'a6b8'] as const;
const ROOKS_VIA_G = ['h1g1', 'h8g8', 'g1h1', 'g8h8'] as const;
const ROOKS_VIA_F = ['h1f1', 'h8f8', 'f1h1', 'f8h8'] as const;

describe('ChessGame draws: threefold repetition', () => {
  test('the third occurrence of a position draws, the second does not', () => {
    const game = new ChessGame(START);
    const trips = [...KNIGHTS_VIA_F3, ...KNIGHTS_VIA_H3];
    expect(firstDrawnPly(game, trips)).toBe(8);
    const s = game.getSnapshot();
    expect(s.fen).toBe(`${START.slice(0, -3)}8 5`);
    expect([s.isGameOver, s.isCheckmate, s.isStalemate]).toEqual([
      true,
      false,
      false,
    ]);
  });

  test('the same pieces with other castling rights is another position', () => {
    // Home is seen with all four rights, then twice with the queenside only:
    // three times the same pieces, but a draw only on the fourth visit.
    const game = new ChessGame(
      'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'
    );
    const trips = [...ROOKS_VIA_G, ...ROOKS_VIA_F, ...ROOKS_VIA_G];
    expect(firstDrawnPly(game, trips)).toBe(12);
    expect(game.getSnapshot().fen).toBe(
      'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Qq - 12 7'
    );
  });

  test('the same pieces with an en passant capture on offer is another position', () => {
    // After d7-d5 White may take en passant; never again once it is declined.
    const game = new ChessGame(
      'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2'
    );
    expect(drawnAfterEach(game, ['d7d5'])).toEqual([false]);
    expect(game.getSnapshot().fen).toContain(' w KQkq d6 ');
    const trips = [...KNIGHTS_VIA_F3, ...KNIGHTS_VIA_H3, ...KNIGHTS_VIA_F3];
    expect(firstDrawnPly(game, trips)).toBe(12);
  });
});

describe('ChessGame draws: fifty-move rule', () => {
  test('99 half-moves without a capture or pawn move play on; 100 draw', () => {
    const game = new ChessGame('4k3/8/8/8/8/8/8/R3K3 w - - 98 80');
    expect(game.getSnapshot().isDraw).toBe(false);
    expect(drawnAfterEach(game, ['a1a2', 'e8e7'])).toEqual([false, true]);
    expect(game.getSnapshot().fen).toBe('8/4k3/8/8/8/8/R7/4K3 w - - 100 81');
    expect(game.getSnapshot().isGameOver).toBe(true);
  });

  test('a capture or pawn move starts the count again', () => {
    const game = new ChessGame('4k3/8/8/8/8/8/r3P3/R3K3 w - - 99 80');
    expect(drawnAfterEach(game, ['e2e3'])).toEqual([false]);
    const taking = new ChessGame('4k3/8/8/8/8/8/r3P3/R3K3 w - - 99 80');
    expect(drawnAfterEach(taking, ['a1a2'])).toEqual([false]);
    expect(taking.getSnapshot().fen).toContain(' b - - 0 80');
  });

  // regression: chess-board-mate-on-hundredth-half-move-also-drawn
  test('a mating 100th half-move is checkmate, not a draw', () => {
    const game = new ChessGame('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80');
    const result = game.tryMove({ from: 'a1', to: 'a8' });
    expect(result.ok && result.isCheckmate).toBe(true);
    const s = game.getSnapshot();
    expect(s.fen).toBe('R5k1/5ppp/8/8/8/8/8/6K1 b - - 100 80');
    expect([s.isCheckmate, s.isDraw, s.isGameOver]).toEqual([
      true,
      false,
      true,
    ]);
  });
});

describe('ChessGame draws: insufficient material', () => {
  test.each([
    ['K v K', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', true],
    ['K+N v K', '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', true],
    ['K+B v K', '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', true],
    ['K+B v K+B, same colour', '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1', true],
    ['K+B v K+B, opposite colours', '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1', false],
    ['K+N+N v K', '4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1', false],
    ['K+N v K+N', '3nk3/8/8/8/8/8/8/1N2K3 w - - 0 1', false],
    ['K+P v K', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', false],
    ['K+R v K', '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', false],
  ] as const)('%s', (_material, fen, drawn) => {
    const s = new ChessGame(fen).getSnapshot();
    expect([s.isDraw, s.isGameOver]).toEqual([drawn, drawn]);
  });

  test('capturing the last piece that could mate draws at once', () => {
    const game = new ChessGame('4k3/8/8/8/8/8/r7/K7 w - - 0 1');
    expect(drawnAfterEach(game, ['a1a2'])).toEqual([true]);
  });
});
