import { describe, expect, test } from 'bun:test';
import { START_FEN } from '@pkgs/chess-rules/fen';
import { perft } from '@pkgs/chess-rules/moves';

/**
 * Chess Programming Wiki perft positions. Depths are the deepest that keep the
 * suite under ~15 s on chess.js (see docs/overnight-decisions.md); each still
 * exercises castling, en passant, promotion and pins.
 */
const CASES: readonly [name: string, fen: string, counts: readonly number[]][] =
  [
    ['startpos', START_FEN, [20, 400, 8902, 197281]],
    [
      'kiwipete',
      'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
      [48, 2039, 97862],
    ],
    [
      'position 3',
      '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
      [14, 191, 2812, 43238],
    ],
    [
      'position 4',
      'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
      [6, 264, 9467],
    ],
    [
      'position 5',
      'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
      [44, 1486, 62379],
    ],
    [
      'position 6',
      'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
      [46, 2079, 89890],
    ],
  ];

describe('perft', () => {
  for (const [name, fen, counts] of CASES) {
    test(name, () => {
      counts.forEach((expected, index) => {
        expect(perft(fen, index + 1)).toBe(expected);
      });
    }, 120_000);
  }

  test('depth 0 is one node; bad input throws', () => {
    expect(perft(START_FEN, 0)).toBe(1);
    expect(() => perft('nope', 1)).toThrow(/invalid FEN/);
    expect(() => perft(START_FEN, -1)).toThrow(/depth/);
  });
});
