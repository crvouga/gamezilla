import { expect, test } from 'bun:test';
import { connectFourPresentation } from '@libs/connect-four-client/connect-four-presentation';

// regression: game-session-ending-descriptions-lost
test('Connect Four keeps its own ending descriptions through the shared presentation contract', () => {
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
