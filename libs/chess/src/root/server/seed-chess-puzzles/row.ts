import { compareCodeUnit } from '../../../shared/chess/code-unit-compare';

/**
 * Pure helpers for converting a parsed Lichess CSV row into chess_puzzles
 * table rows for bulk INSERT.
 */

export type PuzzleTableRow = {
  readonly id: string;
  readonly fen: string;
  readonly moves: string;
  readonly rating: number;
  readonly rating_deviation: number;
  readonly popularity: number;
  readonly nb_plays: number;
  readonly themes: string;
  readonly game_url: string | null;
  readonly opening_tags: string;
};

export type PuzzleBatchEntry = {
  puzzleId: string;
  row: PuzzleTableRow;
};

function splitSpaceSorted(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(parts)].sort(compareCodeUnit);
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

export function rowToPuzzleTableRow(
  row: Record<string, unknown>
): PuzzleTableRow | null {
  const required = readRequiredFields(row);
  if (required === null) return null;
  const themes = splitSpaceSorted(row['Themes']);
  const openingTags = splitSpaceSorted(row['OpeningTags']);
  return {
    id: required.puzzleId,
    fen: required.fen,
    moves: required.moves,
    rating: readNonNegativeInt(row['Rating']),
    rating_deviation: readNonNegativeInt(row['RatingDeviation']),
    popularity: readNonNegativeInt(row['Popularity']),
    nb_plays: readNonNegativeInt(row['NbPlays']),
    themes: JSON.stringify(themes),
    game_url: readNullableTrimmedString(row['GameUrl']),
    opening_tags: JSON.stringify(openingTags),
  };
}

export function rowToPuzzleBatchEntry(
  row: Record<string, unknown>
): PuzzleBatchEntry | null {
  const tableRow = rowToPuzzleTableRow(row);
  if (tableRow === null) return null;
  return { puzzleId: tableRow.id, row: tableRow };
}
