import { expect, test } from 'bun:test';
import { chessPresentation } from '@libs/chess-root-client/chess-game-presentation';

/**
 * Chess's own draws that no shared fixture reaches keep their own words;
 * that every game's endings keep theirs, and that a draw on time names the
 * side that ran out, is the shared `rules/ending-descriptions` suite.
 */
// regression: game-session-ending-descriptions-lost
test("chess's stalemate and lack of mating material keep their own descriptions", () => {
  expect(chessPresentation.endingDescription('stalemate')).toBe(
    'By stalemate.'
  );
  expect(chessPresentation.endingDescription('insufficient material')).toBe(
    'Neither side can checkmate.'
  );
});
