/**
 * FEN parse / serialize with per-field validation. Structural checks are ours
 * (so errors name the broken field); position legality (king count, side not to
 * move in check, pawns on back ranks) is delegated to chess.js `validateFen`.
 */
import { validateFen } from 'chess.js';

export type Color = 'w' | 'b';

export type FenFields = {
  readonly placement: string;
  readonly sideToMove: Color;
  /** `-` or a subset of `KQkq` in that order. */
  readonly castling: string;
  /** `-` or a square on rank 3 / 6. */
  readonly enPassant: string;
  readonly halfmoveClock: number;
  readonly fullmoveNumber: number;
};

export type FenField =
  | 'fieldCount'
  | 'placement'
  | 'sideToMove'
  | 'castling'
  | 'enPassant'
  | 'halfmoveClock'
  | 'fullmoveNumber'
  | 'position';

export type FenError = { readonly field: FenField; readonly message: string };

export type FenParseResult =
  | { readonly ok: true; readonly fields: FenFields }
  | { readonly ok: false; readonly error: FenError };

const PIECE_RE = /^[pnbrqkPNBRQK]$/;
const CASTLING_RE = /^(-|K?Q?k?q?)$/;
const EN_PASSANT_RE = /^(-|[a-h][36])$/;
const COUNTER_RE = /^\d+$/;

function fail(field: FenField, message: string): FenParseResult {
  return { ok: false, error: { field, message } };
}

function placementError(placement: string): string | null {
  const ranks = placement.split('/');
  if (ranks.length !== 8) {
    return `expected 8 ranks separated by '/', got ${ranks.length}`;
  }
  for (const [index, rank] of ranks.entries()) {
    let files = 0;
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') files += Number(ch);
      else if (PIECE_RE.test(ch)) files += 1;
      else return `rank ${8 - index} has invalid character '${ch}'`;
    }
    if (files !== 8) {
      return `rank ${8 - index} covers ${files} files, expected 8`;
    }
  }
  return null;
}

function structuralError(parts: readonly string[]): FenError | null {
  const [placement, side, castling, ep, half, full] = parts;
  const placementProblem = placementError(placement ?? '');
  if (placementProblem !== null) {
    return { field: 'placement', message: placementProblem };
  }
  if (side !== 'w' && side !== 'b') {
    return {
      field: 'sideToMove',
      message: `expected 'w' or 'b', got '${side}'`,
    };
  }
  if (
    castling === undefined ||
    castling === '' ||
    !CASTLING_RE.test(castling)
  ) {
    return {
      field: 'castling',
      message: `expected '-' or a subset of 'KQkq' in order, got '${castling}'`,
    };
  }
  if (ep === undefined || !EN_PASSANT_RE.test(ep)) {
    return {
      field: 'enPassant',
      message: `expected '-' or a rank-3/6 square, got '${ep}'`,
    };
  }
  if (ep !== '-' && (side === 'w') !== (ep[1] === '6')) {
    return {
      field: 'enPassant',
      message: `en-passant square ${ep} does not match side to move '${side}'`,
    };
  }
  if (half === undefined || !COUNTER_RE.test(half)) {
    return {
      field: 'halfmoveClock',
      message: `expected a non-negative integer, got '${half}'`,
    };
  }
  if (full === undefined || !COUNTER_RE.test(full) || Number(full) < 1) {
    return {
      field: 'fullmoveNumber',
      message: `expected a positive integer, got '${full}'`,
    };
  }
  return null;
}

/** Parses all six FEN fields; the error names the first broken field. */
export function parseFen(fen: string): FenParseResult {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) {
    return fail(
      'fieldCount',
      `expected 6 space-separated fields, got ${parts.length}`
    );
  }
  const structural = structuralError(parts);
  if (structural !== null) return { ok: false, error: structural };
  const semantic = validateFen(parts.join(' '));
  if (!semantic.ok)
    return fail('position', semantic.error ?? 'illegal position');
  const [placement, side, castling, enPassant, half, full] = parts as [
    string,
    Color,
    string,
    string,
    string,
    string,
  ];
  return {
    ok: true,
    fields: {
      placement,
      sideToMove: side,
      castling,
      enPassant,
      halfmoveClock: Number(half),
      fullmoveNumber: Number(full),
    },
  };
}

export function serializeFen(fields: FenFields): string {
  return [
    fields.placement,
    fields.sideToMove,
    fields.castling,
    fields.enPassant,
    String(fields.halfmoveClock),
    String(fields.fullmoveNumber),
  ].join(' ');
}

/**
 * Side to move from a FEN's second field, without full validation — for hot
 * paths (board orientation) that already hold a known-good FEN. Missing or
 * malformed fields read as white.
 */
export function sideToMoveOf(fen: string): Color {
  const parts = fen.trim().split(/\s+/);
  return parts[1] === 'b' ? 'b' : 'w';
}

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
