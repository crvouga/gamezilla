import { expect, test } from 'bun:test';
import { chessPresentation } from '@libs/chess-root-client/chess-game-presentation';
import { connectFourPresentation } from '@libs/connect-four-root-client/connect-four-presentation';

// regression: game-session-ending-descriptions-lost
test('concrete adapters retain distinct ending descriptions through the shared presentation contract', () => {
  expect(chessPresentation.endingDescription('stalemate')).toBe(
    'By stalemate.'
  );
  expect(chessPresentation.endingDescription('insufficient material')).toBe(
    'Neither side can checkmate.'
  );
  expect(chessPresentation.timeoutDrawDescription('white')).toBe(
    'White ran out of time, but the other side cannot checkmate.'
  );
  expect(connectFourPresentation.endingDescription('four in a row')).toBe(
    'Four in a row.'
  );
  expect(connectFourPresentation.endingDescription('full board')).toBe(
    'The board is full. Game drawn.'
  );
  expect(
    connectFourPresentation.endingDescription('stalemate')
  ).toBeUndefined();
});
