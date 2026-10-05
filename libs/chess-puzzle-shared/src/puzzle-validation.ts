/**
 * The §4 puzzle model and the §23 ingest validation pass, shared by every
 * ingest path (streaming Lichess seed, committed load file, web harness seed) and
 * the §35 full-database validation job. Pure: the rules kernel is the only
 * dependency, and the position key is a deterministic hash (no crypto / Io).
 *
 * Lichess convention: `fen` is the position BEFORE the opponent's setup move,
 * `moves[0]` is that setup move, the solver plays `moves[1]`, `moves[3]`, …,
 * and the line ends on a solver move (even length). The solver is therefore
 * the side NOT to move in `fen`.
 */
import type { Color } from '@pkgs/chess-rules-shared/fen';
import { fenConsistencyError, parseFen } from '@pkgs/chess-rules-shared/fen';
import { playUci } from '@pkgs/chess-rules-shared/moves';
import { parseUci, tokenizeUciLine } from '@pkgs/chess-rules-shared/uci';
import { fnv1a64Hex } from '@pkgs/room-root-shared/hash-room-state';
import { Chess } from 'chess.js';

import { compareCodeUnit } from './code-unit-compare';

/** §4 logical puzzle (`moves` is physically a space-separated text column). */
export type Puzzle = {
  readonly id: string;
  readonly fen: string;
  /** Canonical UCI; `moves[0]` is the opponent's setup move. */
  readonly moves: readonly string[];
  readonly rating: number;
  readonly ratingDeviation: number;
  readonly popularity: number;
  readonly plays: number;
  readonly themes: readonly string[];
  readonly openingTags: readonly string[];
  readonly sourceGameUrl: string | null;
  /** Side the user solves as: the inverse of `fen`'s side to move. */
  readonly solverColor: Color;
  /** Dedupe key: hash of FEN fields 1–4 + the full line. */
  readonly positionKey: string;
};

export const PUZZLE_REJECTION_REASONS = [
  'missingField',
  'invalidFen',
  'malformedMove',
  'tooShort',
  'illegalMove',
  'oddLength',
  'invalidNumber',
] as const;

export type PuzzleRejectionReason = (typeof PUZZLE_REJECTION_REASONS)[number];

export type PuzzleValidation =
  | { readonly ok: true; readonly puzzle: Puzzle }
  | {
      readonly ok: false;
      readonly id: string;
      readonly reason: PuzzleRejectionReason;
      readonly detail: string;
    };

/** Source-agnostic cells of one puzzle row (CSV or DB). */
export type RawPuzzleFields = {
  readonly id: unknown;
  readonly fen: unknown;
  readonly moves: unknown;
  readonly rating: unknown;
  readonly ratingDeviation: unknown;
  readonly popularity: unknown;
  readonly plays: unknown;
  readonly themes: readonly string[];
  readonly openingTags: readonly string[];
  readonly gameUrl: unknown;
};

const INTEGER_RE = /^-?\d+$/;

function text(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' || typeof raw === 'bigint') return String(raw);
  return '';
}

function reject(
  id: string,
  reason: PuzzleRejectionReason,
  detail: string
): PuzzleValidation {
  return { ok: false, id, reason, detail };
}

/** Solver side for a Lichess-convention FEN (inverted side to move). */
export function solverColorOfFen(sideToMove: Color): Color {
  return sideToMove === 'w' ? 'b' : 'w';
}

/**
 * Deterministic dedupe key: FEN fields 1–4 (placement, side, castling, en
 * passant — clocks do not change the puzzle) plus the canonical line.
 */
export function puzzlePositionKey(
  fenFields: readonly string[],
  moves: readonly string[]
): string {
  return fnv1a64Hex(`${fenFields.slice(0, 4).join(' ')}|${moves.join(' ')}`);
}

type NumberCells = Pick<
  Puzzle,
  'rating' | 'ratingDeviation' | 'popularity' | 'plays'
>;

function readNumbers(raw: RawPuzzleFields): NumberCells | string {
  const cells = {
    rating: text(raw.rating),
    ratingDeviation: text(raw.ratingDeviation),
    popularity: text(raw.popularity),
    plays: text(raw.plays),
  };
  for (const [name, cell] of Object.entries(cells)) {
    if (!INTEGER_RE.test(cell)) return `${name} '${cell}' is not an integer`;
    // Popularity is Lichess's up/down vote ratio in [-100, 100].
    if (name !== 'popularity' && Number(cell) < 0) {
      return `${name} ${cell} is negative`;
    }
  }
  return {
    rating: Number(cells.rating),
    ratingDeviation: Number(cells.ratingDeviation),
    popularity: Number(cells.popularity),
    plays: Number(cells.plays),
  };
}

type LineCheck =
  | { readonly ok: true; readonly moves: readonly string[] }
  | {
      readonly ok: false;
      readonly reason: PuzzleRejectionReason;
      readonly detail: string;
    };

/** Plays the whole line from `fen`; returns the canonical UCI tokens. */
function checkLine(fen: string, tokens: readonly string[]): LineCheck {
  const malformed = tokens.findIndex((token) => parseUci(token) === null);
  if (malformed >= 0) {
    return {
      ok: false,
      reason: 'malformedMove',
      detail: `ply ${malformed}: '${tokens[malformed]}' is not UCI`,
    };
  }
  if (tokens.length < 2) {
    return {
      ok: false,
      reason: 'tooShort',
      detail: `${tokens.length} move(s); need the setup move and a solver reply`,
    };
  }
  const chess = new Chess(fen);
  const canonical: string[] = [];
  for (const [ply, token] of tokens.entries()) {
    const san = playUci(chess, token);
    if (san === null) {
      return {
        ok: false,
        reason: 'illegalMove',
        detail: `ply ${ply}: ${token} is illegal in ${chess.fen()}`,
      };
    }
    canonical.push(canonicalUci(token, san));
  }
  if (tokens.length % 2 !== 0) {
    return {
      ok: false,
      reason: 'oddLength',
      detail: `${tokens.length} plies: the line ends on the opponent's move`,
    };
  }
  return { ok: true, moves: canonical };
}

/**
 * The kernel accepts castling written king-onto-own-rook (`e1h1`); store the
 * king-two-squares form (`e1g1`). Every other legal token is already
 * canonical. (Cheaper than chess.js verbose history on the ingest hot path.)
 */
function canonicalUci(token: string, san: string): string {
  if (!san.startsWith('O-O')) return token;
  const from = token.slice(0, 2);
  const file = san.startsWith('O-O-O') ? 'c' : 'g';
  return `${from}${file}${from[1] ?? ''}`;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((v) => v.length > 0))].sort(compareCodeUnit);
}

/** §23 validation pass over source-agnostic cells. */
export function validatePuzzleFields(raw: RawPuzzleFields): PuzzleValidation {
  const id = text(raw.id);
  const fen = text(raw.fen).split(/\s+/).join(' ');
  const movesText = text(raw.moves);
  if (id.length === 0 || fen.length === 0 || movesText.length === 0) {
    return reject(id, 'missingField', 'id, fen and moves are required');
  }
  const parsed = parseFen(fen);
  if (!parsed.ok) {
    return reject(
      id,
      'invalidFen',
      `${parsed.error.field}: ${parsed.error.message}`
    );
  }
  const inconsistent = fenConsistencyError(parsed.fields);
  if (inconsistent !== null) {
    return reject(
      id,
      'invalidFen',
      `${inconsistent.field}: ${inconsistent.message}`
    );
  }
  const line = checkLine(fen, tokenizeUciLine(movesText));
  if (!line.ok) return reject(id, line.reason, line.detail);
  const numbers = readNumbers(raw);
  if (typeof numbers === 'string') return reject(id, 'invalidNumber', numbers);
  const gameUrl = text(raw.gameUrl);
  return {
    ok: true,
    puzzle: {
      id,
      fen,
      moves: line.moves,
      ...numbers,
      themes: uniqueSorted(raw.themes),
      openingTags: uniqueSorted(raw.openingTags),
      sourceGameUrl: gameUrl.length > 0 ? gameUrl : null,
      solverColor: solverColorOfFen(parsed.fields.sideToMove),
      positionKey: puzzlePositionKey(fen.split(' '), line.moves),
    },
  };
}
