/**
 * Pure helpers for converting a parsed Lichess CSV row into the
 * `(patches, snapshots)` shapes the fast-path writer expects.
 *
 * No SQL, no I/O — exported so unit tests can pin the canonical-JSON /
 * content-addressed id behaviour without booting the seed runtime.
 */
import { ChessPuzzleAttr } from '@libs/chess/shared/chess-puzzle-entities';
import {
  PATCH_CREATED_BY_ID,
  PATCH_SESSION_ID,
  PATCH_SYNCED_AT,
} from '@pkgs/patch-db/interface';
import { createHash } from 'node:crypto';

export type PuzzleBatchEntry = {
  puzzleId: string;
  /** User-facing attributes (snapshot shape — no patch metadata). */
  snapshotAttrs: Record<string, unknown>;
  /** Patch-shape attributes (snapshot attrs + patch metadata). */
  patchAttrs: Record<string, unknown>;
  patchId: string;
};

export function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) {
    sorted[k] = obj[k];
  }
  return JSON.stringify(sorted);
}

export function contentAddressedPatchId(
  attrs: Record<string, unknown>
): string {
  return createHash('sha256')
    .update(canonicalJson(attrs), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

function splitSpaceSorted(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)].sort((a, b) => a.localeCompare(b));
}

function readNonNegativeInt(raw: unknown): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function readNullableTrimmedString(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

type RequiredPuzzleFields = { puzzleId: string; fen: string; moves: string };

function readRequiredFields(
  row: Record<string, unknown>
): RequiredPuzzleFields | null {
  const puzzleId = String(row['PuzzleId'] ?? '').trim();
  if (puzzleId.length === 0) return null;
  const fen = String(row['FEN'] ?? '').trim();
  const moves = String(row['Moves'] ?? '').trim();
  if (fen.length === 0 || moves.length === 0) return null;
  return { puzzleId, fen, moves };
}

/**
 * Build the user attributes for a single puzzle row, omitting fields whose
 * value would round-trip identically through the corresponding
 * {@link ChessPuzzleAttr} reader from a missing key:
 *
 * - `gameUrl: null`   — `readTrimmedNullableString` returns `null` for missing
 * - `themes: []`      — `readStringArray` returns `[]` for missing
 * - `openingTags: []` — `readStringArray` returns `[]` for missing
 *
 * Numeric zero values (`rating`, `popularity`, etc.) are kept verbatim
 * because the declarative `pdb_idx_chess_puzzle__puzzle_popularity`
 * snapshot index uses `(attributes->>'chess.puzzle/popularity')` which
 * yields SQL NULL for missing keys — we don't want zero-popularity puzzles
 * vanishing from the picker's `ORDER BY … DESC` index plan.
 */
export function rowToPuzzleAttributes(
  row: Record<string, unknown>
): Record<string, unknown> | null {
  const required = readRequiredFields(row);
  if (required === null) return null;

  const attrs: Record<string, unknown> = {
    [ChessPuzzleAttr.id.key]: required.puzzleId,
    [ChessPuzzleAttr.fen.key]: required.fen,
    [ChessPuzzleAttr.moves.key]: required.moves,
    [ChessPuzzleAttr.rating.key]: readNonNegativeInt(row['Rating']),
    [ChessPuzzleAttr.ratingDeviation.key]: readNonNegativeInt(
      row['RatingDeviation']
    ),
    [ChessPuzzleAttr.popularity.key]: readNonNegativeInt(row['Popularity']),
    [ChessPuzzleAttr.nbPlays.key]: readNonNegativeInt(row['NbPlays']),
  };
  const themes = splitSpaceSorted(row['Themes']);
  if (themes.length > 0) {
    attrs[ChessPuzzleAttr.themes.key] = themes;
  }
  const gameUrl = readNullableTrimmedString(row['GameUrl']);
  if (gameUrl !== null) {
    attrs[ChessPuzzleAttr.gameUrl.key] = gameUrl;
  }
  const openingTags = splitSpaceSorted(row['OpeningTags']);
  if (openingTags.length > 0) {
    attrs[ChessPuzzleAttr.openingTags.key] = openingTags;
  }
  return attrs;
}

/**
 * Mirrors {@link normalizePatchAttributesForStorage}'s output for a fresh
 * system-context patch with no createdBy / sessionId / syncedAt. Inlined
 * so the seed doesn't pay the per-batch parent-id resolution round-trip
 * that `accumulateWritePatchesPostgres` does for the (always-null,
 * root-only) puzzle case.
 */
export function buildPatchAttrs(
  snapshotAttrs: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...snapshotAttrs,
    [PATCH_CREATED_BY_ID]: '',
    [PATCH_SESSION_ID]: '',
    [PATCH_SYNCED_AT]: null,
  };
}

export function rowToPuzzleBatchEntry(
  row: Record<string, unknown>
): PuzzleBatchEntry | null {
  const snapshotAttrs = rowToPuzzleAttributes(row);
  if (snapshotAttrs === null) return null;
  const puzzleId = String(snapshotAttrs[ChessPuzzleAttr.id.key]);
  const patchAttrs = buildPatchAttrs(snapshotAttrs);
  const patchId = contentAddressedPatchId(patchAttrs);
  return { puzzleId, snapshotAttrs, patchAttrs, patchId };
}
