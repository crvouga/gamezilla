import { describe, expect, test } from 'bun:test';
import { parseFen } from '@pkgs/chess-rules-shared/fen';
import { canCheckmate } from '@pkgs/chess-rules-shared/mating-material';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { Chess } from 'chess.js';
import fc from 'fast-check';

const ORDER = 'KQRBNP';

function sideMaterial(letters: readonly string[]): string {
  return [...letters]
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .join('+');
}

/** `K+N v K+Q+Q`: White's pieces, then Black's, read off the FEN. */
function materialOf(fen: string): string {
  const letters = [...(fen.split(' ')[0] ?? '')].filter((c) =>
    /[a-z]/i.test(c)
  );
  const white = letters.filter((c) => c === c.toUpperCase());
  const black = letters.filter((c) => c !== c.toUpperCase());
  return `${sideMaterial(white)} v ${sideMaterial(black.map((c) => c.toUpperCase()))}`;
}

function swapCase(text: string): string {
  return [...text]
    .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
    .join('');
}

/** The same position with the colours swapped (board flipped top to bottom). */
function mirrored(fen: string): string {
  const [placement = '', turn] = fen.split(' ');
  const flipped = placement.split('/').reverse().map(swapCase).join('/');
  return `${flipped} ${turn === 'w' ? 'b' : 'w'} - - 0 1`;
}

function can(fen: string): { white: boolean; black: boolean } {
  expect(parseFen(fen).ok).toBe(true);
  const chess = new Chess(fen);
  return { white: canCheckmate(chess, 'w'), black: canCheckmate(chess, 'b') };
}

type Row = readonly [
  material: string,
  note: string,
  fen: string,
  white: boolean,
  black: boolean,
];

/** c1 and f8 are dark squares; f1, c8 and b3 are light. */
const TABLE: readonly Row[] = [
  ['K v K', '', '4k3/8/8/8/8/8/8/4K3 w - - 0 1', false, false],
  ['K+N v K', '', '4k3/8/8/8/8/8/8/1N2K3 w - - 0 1', false, false],
  ['K+N v K+Q', '', '3qk3/8/8/8/8/8/8/1N2K3 w - - 0 1', false, true],
  ['K+N v K+Q+Q', '', '2qqk3/8/8/8/8/8/8/1N2K3 w - - 0 1', false, true],
  ['K+N v K+Q+R', '', '2rqk3/8/8/8/8/8/8/1N2K3 w - - 0 1', true, true],
  ['K+N v K+R', '', '3rk3/8/8/8/8/8/8/1N2K3 w - - 0 1', true, true],
  ['K+N v K+B', '', '3bk3/8/8/8/8/8/8/1N2K3 w - - 0 1', true, true],
  ['K+N v K+N', '', '3nk3/8/8/8/8/8/8/1N2K3 w - - 0 1', true, true],
  ['K+N v K+P', '', '4k3/3p4/8/8/8/8/8/1N2K3 w - - 0 1', true, true],
  ['K+N+N v K', '', '4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1', true, false],
  ['K+B+N v K', '', '4k3/8/8/8/8/8/8/1NB1K3 w - - 0 1', true, false],
  ['K+B v K', '', '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', false, false],
  ['K+B v K+R', '', '3rk3/8/8/8/8/8/8/2B1K3 w - - 0 1', false, true],
  ['K+B v K+R+R', '', '2rrk3/8/8/8/8/8/8/2B1K3 w - - 0 1', false, true],
  ['K+B v K+Q', '', '3qk3/8/8/8/8/8/8/2B1K3 w - - 0 1', false, true],
  ['K+B v K+N', '', '3nk3/8/8/8/8/8/8/2B1K3 w - - 0 1', true, true],
  ['K+B v K+P', '', '4k3/3p4/8/8/8/8/8/2B1K3 w - - 0 1', true, true],
  [
    'K+B v K+B',
    'same colour',
    '4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1',
    false,
    false,
  ],
  [
    'K+B v K+B',
    'opposite colours',
    '2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1',
    true,
    true,
  ],
  [
    'K+B v K+R+B',
    'same colour',
    '3rkb2/8/8/8/8/8/8/2B1K3 w - - 0 1',
    false,
    true,
  ],
  [
    'K+B+B v K',
    'same colour',
    '4k3/8/8/8/8/B7/8/2B1K3 w - - 0 1',
    false,
    false,
  ],
  [
    'K+B+B v K',
    'opposite colours',
    '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1',
    true,
    false,
  ],
  [
    'K+B+B v K+B',
    'all one colour',
    '4kb2/8/8/8/8/B7/8/2B1K3 w - - 0 1',
    false,
    false,
  ],
  ['K+P v K', '', '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', true, false],
  ['K+R v K', '', '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', true, false],
  ['K+Q v K', '', '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1', true, false],
];

describe('canCheckmate by material (FIDE 6.9)', () => {
  for (const [material, note, fen, white, black] of TABLE) {
    const name = note === '' ? material : `${material}, ${note}`;
    test(`${name}: White ${white ? 'can' : 'cannot'}, Black ${black ? 'can' : 'cannot'}`, () => {
      expect(materialOf(fen)).toBe(material);
      expect(can(fen)).toEqual({ white, black });
      expect(can(mirrored(fen))).toEqual({ white: black, black: white });
    });
  }

  test('the start position: both can', () => {
    expect(can(new Chess().fen())).toEqual({ white: true, black: true });
  });
});

/**
 * Every "can" answer for a side with only knights and bishops, proven by a
 * legal position with exactly that material in which White has checkmated.
 */
const MATES: readonly (readonly [material: string, fen: string])[] = [
  ['K+N v K+R', 'kr6/2N5/K7/8/8/8/8/8 b - - 0 1'],
  ['K+N v K+B', 'kb6/8/KN6/8/8/8/8/8 b - - 0 1'],
  ['K+N v K+N', 'kn6/2N5/1K6/8/8/8/8/8 b - - 0 1'],
  ['K+N v K+P', 'k1K5/p1N5/8/8/8/8/8/8 b - - 0 1'],
  ['K+N v K+Q+R', 'kr6/2N5/K7/8/8/8/8/7q b - - 0 1'],
  ['K+N+N v K', 'k7/2N5/K1N5/8/8/8/8/8 b - - 0 1'],
  ['K+B+N v K', 'k7/8/NK6/3B4/8/8/8/8 b - - 0 1'],
  ['K+B v K+N', 'kn6/1B6/1K6/8/8/8/8/8 b - - 0 1'],
  ['K+B v K+P', 'k7/pBK5/8/8/8/8/8/8 b - - 0 1'],
  ['K+B v K+B', 'kb6/8/1KB5/8/8/8/8/8 b - - 0 1'],
  ['K+B+B v K', 'k7/8/1K6/3B4/5B2/8/8/8 b - - 0 1'],
];

describe('canCheckmate: each minor-piece "can" has a mate to show for it', () => {
  for (const [material, fen] of MATES) {
    test(`${material} is a checkmate in ${fen}`, () => {
      expect(materialOf(fen)).toBe(material);
      expect(parseFen(fen).ok).toBe(true);
      const chess = new Chess(fen);
      expect(chess.isCheckmate()).toBe(true);
      expect(canCheckmate(chess, 'w')).toBe(true);
      const flipped = new Chess(mirrored(fen));
      expect(flipped.isCheckmate()).toBe(true);
      expect(canCheckmate(flipped, 'b')).toBe(true);
    });
  }

  test('the table has a mate for every minor-piece "can"', () => {
    const minorOnly = (side: string) => !/[QRP]/.test(side) && side !== 'K';
    const shown = new Set(MATES.map(([material]) => material));
    const needed = TABLE.flatMap(([material, , , white, black]) => {
      const [whiteSide = '', blackSide = ''] = material.split(' v ');
      return [
        ...(white && minorOnly(whiteSide) ? [material] : []),
        ...(black && minorOnly(blackSide)
          ? [`${blackSide} v ${whiteSide}`]
          : []),
      ];
    });
    expect(needed.filter((material) => !shown.has(material))).toEqual([]);
  });
});

/**
 * Sparse starts for random play: two that trade down into every kind of
 * material, then near misses where the side that cannot mate already stands
 * as close to one as its material allows.
 */
const WALK_STARTS = [
  '1nb1k1q1/8/8/8/8/8/8/1NB1K1Q1 w - - 0 1',
  '2b1k1n1/8/8/8/8/8/8/1N2KB2 w - - 0 1',
  'r2qk2r/8/8/8/8/8/8/2B1K3 w - - 0 1',
  'kq6/8/K7/3N4/8/8/8/8 w - - 0 1',
  'kq6/q7/2K5/3N4/8/8/8/8 w - - 0 1',
  'kr6/8/K7/8/8/8/8/5B2 w - - 0 1',
  'kr6/r7/2K5/8/8/8/8/5B2 w - - 0 1',
  'k7/1b6/1K6/8/8/8/8/5B2 w - - 0 1',
] as const;

/**
 * Random legal play. Material never grows back without a pawn, so a side that
 * cannot checkmate stays that way, and never has a mating move (SAN `#`).
 */
function walkWithoutImpossibleMate(start: string, picks: readonly number[]) {
  const chess = new Chess(start);
  const cannot = { w: false, b: false };
  for (const pick of picks) {
    for (const color of ['w', 'b'] as const) {
      const can = canCheckmate(chess, color);
      if (cannot[color]) expect(can).toBe(false);
      cannot[color] = !can;
    }
    const moves = chess.moves();
    if (moves.length === 0) return;
    if (cannot[chess.turn()])
      expect(moves.filter((san) => san.endsWith('#'))).toEqual([]);
    chess.move(moves[pick % moves.length] ?? '');
  }
}

describe('canCheckmate: "cannot" is never contradicted by play', () => {
  test('a side that cannot checkmate never gets a mating move, and never regains the material', () => {
    assertProperty(
      'no checkmate from material that cannot checkmate',
      fc.property(
        fc.constantFrom(...WALK_STARTS),
        fc.array(fc.nat(), { minLength: 60, maxLength: 60 }),
        walkWithoutImpossibleMate
      )
    );
  });
});
