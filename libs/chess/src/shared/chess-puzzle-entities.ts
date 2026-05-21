import { createAttrNamespace } from '@pkgs/attribute';

/** PatchDB entity type for a Lichess puzzle row (static reference data). */
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
    return [...new Set(out)].sort((a, b) => a.localeCompare(b));
  }
  if (typeof v !== 'string') return [];
  const parts = v
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b));
}

const chessPuzzleNs = createAttrNamespace('chess', 'puzzle');

export const ChessPuzzleAttr = {
  /** Lichess `PuzzleId` (same as entity id). */
  id: chessPuzzleNs('id', readString),
  fen: chessPuzzleNs('fen', readString),
  /** Space-separated UCI moves from the export. */
  moves: chessPuzzleNs('moves', readString),
  rating: chessPuzzleNs('rating', readNonNegativeInteger),
  ratingDeviation: chessPuzzleNs('rating-deviation', readNonNegativeInteger),
  popularity: chessPuzzleNs('popularity', readInteger),
  nbPlays: chessPuzzleNs('nb-plays', readNonNegativeInteger),
  themes: chessPuzzleNs('themes', readStringArray),
  gameUrl: chessPuzzleNs('game-url', readTrimmedNullableString),
  openingTags: chessPuzzleNs('opening-tags', readStringArray),
} as const;

/** Loader progress fields use the same `chess.puzzle/` attribute namespace. */
export const ChessPuzzleLoadAttr = {
  /** HTTP `ETag` of the consumed `.csv.zst` (or empty when unknown). */
  sourceEtag: chessPuzzleNs('load-source-etag', readTrimmedNullableString),
  /** Last successfully written Lichess `PuzzleId` (lexicographic resume cursor). */
  cursor: chessPuzzleNs('load-cursor', readTrimmedNullableString),
  /** ISO timestamp when a full pass finished for this ETag. */
  finishedAt: chessPuzzleNs('load-finished-at', readTrimmedNullableString),
} as const;
