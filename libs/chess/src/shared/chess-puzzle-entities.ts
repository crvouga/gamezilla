import { createAttrNamespace } from '@pkgs/attribute';

import { compareCodeUnit } from './code-unit-compare';

/** Sync entity type for a Lichess puzzle row (static reference data). */
export const CHESS_PUZZLE_ENTITY_TYPE = 'chess.puzzle';

/**
 * Singleton progress row for the Lichess puzzle CSV loader (`entityId` =
 * {@link CHESS_PUZZLE_LOAD_ENTITY_ID}).
 */
export const CHESS_PUZZLE_LOAD_ENTITY_TYPE = 'chess.puzzle.load';

/** Fixed entity id for {@link CHESS_PUZZLE_LOAD_ENTITY_TYPE} progress snapshot. */
export const CHESS_PUZZLE_LOAD_ENTITY_ID = 'dataset';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readTrimmedNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readNonNegativeInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v, 10);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return 0;
}

function readInteger(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Sorted unique non-empty strings (CSV themes / opening tags, or JSON string[]). */
function readStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    const out = v
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return [...new Set(out)].sort(compareCodeUnit);
  }
  if (typeof v !== 'string') return [];
  const parts = v
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)].sort(compareCodeUnit);
}

const chessPuzzleNs = createAttrNamespace('chess', 'puzzle');

export const ChessPuzzleAttr = {
  /** Lichess `PuzzleId` (same as entity id). Indexed so picker / player
   * lookups by puzzle id hit a unique btree on a typed `TEXT` generated
   * column instead of falling back to a `WHERE entity_type = ?` scan. */
  id: chessPuzzleNs.text('id', readString).indexed({ unique: true }),
  fen: chessPuzzleNs.text('fen', readString),
  /** Space-separated UCI moves from the export. */
  moves: chessPuzzleNs.text('moves', readString),
  /** Indexed + sortable: the puzzle picker walks puzzles in a rating window
   * (`WHERE rating BETWEEN ? AND ?`), which is unworkable as a JSON TEXT scan. */
  rating: chessPuzzleNs.integer('rating', readNonNegativeInteger).indexed({
    sortable: true,
  }),
  ratingDeviation: chessPuzzleNs.integer(
    'rating-deviation',
    readNonNegativeInteger
  ),
  /** Indexed + sortable: `ORDER BY popularity DESC LIMIT N` is the hot path
   * for the picker; without a numeric btree this sorts 5M rows. */
  popularity: chessPuzzleNs.integer('popularity', readInteger).indexed({
    sortable: true,
  }),
  nbPlays: chessPuzzleNs.integer('nb-plays', readNonNegativeInteger),
  themes: chessPuzzleNs.array('themes', readStringArray),
  gameUrl: chessPuzzleNs.urlOrNull('game-url', readTrimmedNullableString),
  openingTags: chessPuzzleNs.array('opening-tags', readStringArray),
} as const;

/** Loader progress fields use the same `chess.puzzle/` attribute namespace. */
export const ChessPuzzleLoadAttr = {
  /** HTTP `ETag` of the consumed `.csv.zst` (or empty when unknown). */
  sourceEtag: chessPuzzleNs.textOrNull(
    'load-source-etag',
    readTrimmedNullableString
  ),
  /** Last successfully written Lichess `PuzzleId` (lexicographic resume cursor). */
  cursor: chessPuzzleNs.textOrNull('load-cursor', readTrimmedNullableString),
  /** ISO timestamp when a full pass finished for this ETag. */
  finishedAt: chessPuzzleNs.timestampOrNull(
    'load-finished-at',
    readTrimmedNullableString
  ),
} as const;
