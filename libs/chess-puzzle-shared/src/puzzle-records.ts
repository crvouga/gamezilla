/**
 * Row shapes the validator reads: the Lichess CSV (`PuzzleId,FEN,Moves,…`,
 * themes space-separated) and the stored / load-file shape (`id,fen,moves,…`,
 * themes as a JSON array or an already-decoded array).
 */
import type { PuzzleValidation } from './puzzle-validation';
import { validatePuzzleFields } from './puzzle-validation';

/** Lichess CSV header, in file order. */
export const LICHESS_PUZZLE_CSV_COLUMNS = [
  'PuzzleId',
  'FEN',
  'Moves',
  'Rating',
  'RatingDeviation',
  'Popularity',
  'NbPlays',
  'Themes',
  'GameUrl',
  'OpeningTags',
] as const;

function splitWords(raw: unknown): readonly string[] {
  if (typeof raw !== 'string') return [];
  return raw.split(/\s+/).filter((s) => s.length > 0);
}

/** JSON-array cell (text or decoded); a bare word list is accepted too. */
function listCell(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === 'string');
  }
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return splitWords(trimmed);
  try {
    return listCell(JSON.parse(trimmed) as unknown);
  } catch {
    return splitWords(trimmed);
  }
}

/** §23 validation of one Lichess CSV record. */
export function validateLichessPuzzleRow(
  row: Readonly<Record<string, unknown>>
): PuzzleValidation {
  return validatePuzzleFields({
    id: row['PuzzleId'],
    fen: row['FEN'],
    moves: row['Moves'],
    rating: row['Rating'],
    ratingDeviation: row['RatingDeviation'],
    popularity: row['Popularity'],
    plays: row['NbPlays'],
    themes: splitWords(row['Themes']),
    openingTags: splitWords(row['OpeningTags']),
    gameUrl: row['GameUrl'],
  });
}

/** §23 validation of one stored `chess_puzzles` row / load-file record. */
export function validateStoredPuzzleRow(
  row: Readonly<Record<string, unknown>>
): PuzzleValidation {
  return validatePuzzleFields({
    id: row['id'],
    fen: row['fen'],
    moves: row['moves'],
    rating: row['rating'],
    ratingDeviation: row['rating_deviation'],
    popularity: row['popularity'],
    plays: row['nb_plays'],
    themes: listCell(row['themes']),
    openingTags: listCell(row['opening_tags']),
    gameUrl: row['game_url'],
  });
}

/** Validates a record of either shape (Lichess header detected by `PuzzleId`). */
export function validatePuzzleRecord(
  row: Readonly<Record<string, unknown>>
): PuzzleValidation {
  return 'PuzzleId' in row
    ? validateLichessPuzzleRow(row)
    : validateStoredPuzzleRow(row);
}
