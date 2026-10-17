import { expect, test } from 'bun:test';
import { chessPresentation } from '@libs/chess-root-client/chess-game-presentation';

// regression: game-session-ending-descriptions-lost
test('chess keeps its own ending descriptions through the shared presentation contract', () => {
  expect(chessPresentation.endingDescription('stalemate')).toBe(
    'By stalemate.'
  );
  expect(chessPresentation.endingDescription('insufficient material')).toBe(
    'Neither side can checkmate.'
  );
  expect(chessPresentation.timeoutDrawDescription('white')).toBe(
    'White ran out of time, but the other side cannot checkmate.'
  );
});
