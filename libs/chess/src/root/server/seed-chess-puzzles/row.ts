import type { Puzzle } from '../../../shared/puzzle-data/puzzle-validation';

/**
 * Physical `chess_puzzles` row for bulk INSERT. `moves` is the §4 `moves[]`
 * as space-separated canonical UCI; themes / opening tags are JSON arrays.
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
  readonly position_key: string;
};

export type PuzzleBatchEntry = {
  puzzleId: string;
  row: PuzzleTableRow;
};

/** Table row of a puzzle that passed the §23 validation pass. */
export function puzzleTableRowOf(puzzle: Puzzle): PuzzleTableRow {
  return {
    id: puzzle.id,
    fen: puzzle.fen,
    moves: puzzle.moves.join(' '),
    rating: puzzle.rating,
    rating_deviation: puzzle.ratingDeviation,
    popularity: puzzle.popularity,
    nb_plays: puzzle.plays,
    themes: JSON.stringify(puzzle.themes),
    game_url: puzzle.sourceGameUrl,
    opening_tags: JSON.stringify(puzzle.openingTags),
    position_key: puzzle.positionKey,
  };
}
