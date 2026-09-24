/**
 * Legal destinations of one piece — what a pick-up paints as dots, what a
 * drop checks for promotion — at the cost of one move generation.
 *
 * chess.js's public answer (`moves({ square, verbose: true })`) builds a
 * `Move` per destination, and each `Move` computes its SAN (a full-board
 * legal-move generation for disambiguation) plus the FEN before and after
 * (a make / undo): a queen pick-up is ~20 full generations and ~40 FENs —
 * quadratic, on every tap, on a phone. The board only needs squares and two
 * flags, which chess.js's move generator already has.
 *
 * The generator is chess.js-internal (`_moves`), so it is read defensively:
 * where it is missing (a future chess.js), the public API answers instead,
 * slower but identical. `destinations.test.ts` pins the two as equal on
 * random positions and fails if the fast path goes away.
 */

import type { Chess } from 'chess.js';

import type { Square } from './types';

export type Destination = {
  readonly to: Square;
  /** A pawn reaching the last rank (the four promotions collapse to one). */
  readonly promotion: boolean;
  /** Castling: `k` kingside, `q` queenside. */
  readonly castle: 'k' | 'q' | null;
};

/** chess.js move-generator entry (0x88 squares, flag bits). */
type InternalMove = {
  readonly to: number;
  readonly flags: number;
};

type InternalGenerator = (options: {
  readonly square: string;
  readonly legal: boolean;
}) => readonly InternalMove[];

// chess.js `BITS`.
const PROMOTION = 16;
const KSIDE_CASTLE = 32;
const QSIDE_CASTLE = 64;

const FILES = 'abcdefgh';

/** 0x88 index → algebraic square. */
function algebraic(square: number): Square {
  const file = FILES[square & 0xf] ?? 'a';
  const rank = 8 - (square >> 4);
  return `${file}${rank}` as Square;
}

function castleOf(flags: number): 'k' | 'q' | null {
  if ((flags & KSIDE_CASTLE) !== 0) return 'k';
  if ((flags & QSIDE_CASTLE) !== 0) return 'q';
  return null;
}

/** The internal generator bound to `chess`, or null where it is missing. */
function internalGenerator(chess: Chess): InternalGenerator | null {
  const generate: unknown = Reflect.get(chess, '_moves');
  if (typeof generate !== 'function') return null;
  return (options) =>
    (generate as (o: typeof options) => readonly InternalMove[]).call(
      chess,
      options
    );
}

/** Whether this chess.js exposes the fast path. */
export function hasFastDestinations(chess: Chess): boolean {
  return internalGenerator(chess) !== null;
}

function collapse(
  moves: Iterable<{ to: Square; promotion: boolean; castle: 'k' | 'q' | null }>
): readonly Destination[] {
  const out: Destination[] = [];
  const seen = new Set<Square>();
  for (const m of moves) {
    if (seen.has(m.to)) continue;
    seen.add(m.to);
    out.push(m);
  }
  return out;
}

/** One generation, no SAN, no FEN; null when the fast path is missing. */
export function destinationsFromInternals(
  chess: Chess,
  from: Square
): readonly Destination[] | null {
  const generate = internalGenerator(chess);
  if (generate === null) return null;
  return collapse(
    generate({ square: from, legal: true }).map((m) => ({
      to: algebraic(m.to),
      promotion: (m.flags & PROMOTION) !== 0,
      castle: castleOf(m.flags),
    }))
  );
}

/** The public-API answer (slow; the fallback and the test oracle). */
export function destinationsFromPublicApi(
  chess: Chess,
  from: Square
): readonly Destination[] {
  return collapse(
    chess.moves({ square: from, verbose: true }).map((m) => ({
      to: m.to as Square,
      promotion: m.promotion !== undefined,
      castle: m.isKingsideCastle() ? 'k' : m.isQueensideCastle() ? 'q' : null,
    }))
  );
}

export function destinationsFrom(
  chess: Chess,
  from: Square
): readonly Destination[] {
  return (
    destinationsFromInternals(chess, from) ??
    destinationsFromPublicApi(chess, from)
  );
}
