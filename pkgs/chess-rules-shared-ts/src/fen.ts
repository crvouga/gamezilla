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

/** Piece letter on `square` (`e1`) of a structurally valid placement, or null. */
function pieceOn(placement: string, square: string): string | null {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const row = placement.split('/')[8 - rank] ?? '';
  let col = 0;
  for (const ch of row) {
    if (ch >= '1' && ch <= '8') {
      col += Number(ch);
      continue;
    }
    if (col === file) return ch;
    col += 1;
  }
  return null;
}

/** King square + rook square each castling right requires (standard chess). */
const CASTLING_HOMES: Readonly<
  Record<string, { king: string; rook: string; k: string; r: string }>
> = {
  K: { king: 'e1', rook: 'h1', k: 'K', r: 'R' },
  Q: { king: 'e1', rook: 'a1', k: 'K', r: 'R' },
  k: { king: 'e8', rook: 'h8', k: 'k', r: 'r' },
  q: { king: 'e8', rook: 'a8', k: 'k', r: 'r' },
};

function castlingConsistencyError(fields: FenFields): FenError | null {
  if (fields.castling === '-') return null;
  for (const right of fields.castling) {
    const home = CASTLING_HOMES[right];
    if (home === undefined) continue;
    if (
      pieceOn(fields.placement, home.king) !== home.k ||
      pieceOn(fields.placement, home.rook) !== home.r
    ) {
      return {
        field: 'castling',
        message: `castling right '${right}' needs ${home.k} on ${home.king} and ${home.r} on ${home.rook}`,
      };
    }
  }
  return null;
}

function enPassantConsistencyError(fields: FenFields): FenError | null {
  const ep = fields.enPassant;
  if (ep === '-') return null;
  const file = ep[0] ?? '';
  // White to move ⇒ Black just double-pushed: pawn on rank 5, ep on rank 6.
  const white = fields.sideToMove === 'w';
  const pawnSquare = `${file}${white ? 5 : 4}`;
  const originSquare = `${file}${white ? 7 : 2}`;
  if (pieceOn(fields.placement, pawnSquare) !== (white ? 'p' : 'P')) {
    return {
      field: 'enPassant',
      message: `en-passant square ${ep} has no double-pushed pawn on ${pawnSquare}`,
    };
  }
  if (
    pieceOn(fields.placement, ep) !== null ||
    pieceOn(fields.placement, originSquare) !== null
  ) {
    return {
      field: 'enPassant',
      message: `en-passant square ${ep} or ${originSquare} is occupied`,
    };
  }
  return null;
}

/**
 * Cross-field consistency chess.js does not check: every castling right has
 * its king and rook on their home squares, and an en-passant square sits
 * behind a pawn that just double-pushed. `null` when consistent. Takes the
 * fields of a successful {@link parseFen}.
 */
export function fenConsistencyError(fields: FenFields): FenError | null {
  return castlingConsistencyError(fields) ?? enPassantConsistencyError(fields);
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

/**
 * FEN fields 1–4 (placement, side to move, castling, en passant): what makes
 * two positions the same position, whatever their move clocks say.
 */
export function positionPartOf(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

/** True when both FENs describe the same position (fields 1–4 equal). */
export function isSamePosition(a: string, b: string): boolean {
  return positionPartOf(a) === positionPartOf(b);
}

export const START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
