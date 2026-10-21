import { afterEach, describe, expect, test } from 'bun:test';
import {
  destinationsFromInternals,
  destinationsFromPublicApi,
  hasFastDestinations,
} from '@pkgs/chess-board-core-shared-ts/destinations';
import { ChessGame } from '@pkgs/chess-board-core-shared-ts/game';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { Chess } from 'chess.js';
import fc from 'fast-check';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A position reached by random legal play (castles, promotions, e.p. …). */
const positions = fc.array(fc.nat(), { maxLength: 160 }).map((picks) => {
  const chess = new Chess(START);
  for (const pick of picks) {
    const moves = chess.moves({ verbose: true });
    const m = moves[pick % Math.max(1, moves.length)];
    if (m === undefined) break;
    chess.move(m);
  }
  return chess;
});

const sorted = (list: readonly { to: Square }[]) =>
  [...list].sort((a, b) => a.to.localeCompare(b.to));

let restore: (() => void) | undefined;
afterEach(() => {
  restore?.();
  restore = undefined;
});

describe('destinations', () => {
  test('this chess.js has the fast path (a slow fallback must be a decision)', () => {
    expect(hasFastDestinations(new Chess())).toBe(true);
  });

  test('the fast path answers exactly what chess.js public moves answer', () => {
    assertProperty(
      'destinations-equal',
      fc.property(positions, (chess) => {
        for (const row of chess.board()) {
          for (const cell of row) {
            if (cell === null || cell.color !== chess.turn()) continue;
            const from = cell.square as Square;
            expect(
              sorted(destinationsFromInternals(chess, from) ?? [])
            ).toEqual(sorted(destinationsFromPublicApi(chess, from)));
          }
        }
      })
    );
  });

  test('a pick-up reuses the legal destinations already generated for status', () => {
    const game = new ChessGame(
      'r3k2r/pppqbppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQBPPP/R3K2R w KQkq - 0 1'
    );
    const proto = Chess.prototype as unknown as Record<string, unknown>;
    const original = proto['_moves'] as (...a: unknown[]) => unknown;
    let generations = 0;
    proto['_moves'] = function (this: Chess, ...args: unknown[]) {
      generations += 1;
      return original.apply(this, args);
    };
    restore = () => {
      proto['_moves'] = original;
    };
    expect([...game.legalMovesFrom('e1')].sort()).toEqual([
      'a1',
      'c1',
      'd1',
      'f1',
      'g1',
      'h1',
    ]);
    expect(generations).toBe(0);
    game.legalMovesFrom('e1');
    game.moveRequiresPromotion('e1', 'g1');
    expect(generations).toBe(0);
  });
});
