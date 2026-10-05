/** Path relative to the `@libs/chess-puzzle-server` package root. */
export const CHESS_PUZZLES_LOAD_FILE_RELATIVE =
  'scripts/fixtures/chess-puzzles.load.csv';

/** Bounded export size for the committed local-dev load file. */
export const CHESS_PUZZLES_LOAD_EXPORT_LIMIT = 2000;

/**
 * Source-of-truth Postgres query for the committed load file.
 * Columns match {@link PuzzleTableRow} / the bulk INSERT path.
 */
export const CHESS_PUZZLES_LOAD_EXPORT_SQL = `
SELECT
  id,
  fen,
  moves,
  rating,
  rating_deviation,
  popularity,
  nb_plays,
  themes,
  game_url,
  opening_tags
FROM chess_puzzles
ORDER BY popularity DESC NULLS LAST, id ASC
LIMIT ${String(CHESS_PUZZLES_LOAD_EXPORT_LIMIT)}
`.trim();

export const CHESS_PUZZLES_LOAD_CSV_COLUMNS = [
  'id',
  'fen',
  'moves',
  'rating',
  'rating_deviation',
  'popularity',
  'nb_plays',
  'themes',
  'game_url',
  'opening_tags',
] as const;

export type ChessPuzzlesLoadCsvColumn =
  (typeof CHESS_PUZZLES_LOAD_CSV_COLUMNS)[number];
