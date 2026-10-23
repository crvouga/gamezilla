import type { Puzzle } from '@libs/chess-puzzle-shared-ts/puzzle-validation';
import { CHESS_TURN_GAMES } from '@libs/chess-sub-shared-ts/chess-game';
import type { CatalogueRow } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import { admitCataloguePuzzle } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';

export type PuzzleBatchEntry = {
  puzzleId: string;
  row: CatalogueRow;
};

/**
 * The catalogue row of a puzzle that passed the §23 validation pass, as the
 * platform admits it into chess's namespace (`moves` the canonical UCI
 * line, themes and opening tags JSON arrays). The platform validates it
 * again through chess's own `content.validate`, so a refusal here means
 * the two disagree: that is a defect, never a skipped row.
 */
export function puzzleTableRowOf(puzzle: Puzzle): CatalogueRow {
  const admission = admitCataloguePuzzle(CHESS_TURN_GAMES, {
    record: {
      id: puzzle.id,
      position: puzzle.fen,
      line: puzzle.moves,
      rating: puzzle.rating,
      ratingDeviation: puzzle.ratingDeviation,
      popularity: puzzle.popularity,
      plays: puzzle.plays,
      themes: puzzle.themes,
    },
    source: { url: puzzle.sourceGameUrl, tags: puzzle.openingTags },
  });
  if (!admission.ok)
    throw new Error(
      `the catalogue refused a puzzle chess validated (${admission.reason}): ${admission.detail}`
    );
  return admission.row;
}
