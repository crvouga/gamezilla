import { expect, test } from 'bun:test';
import {
  encodeHearts,
  INITIAL_HEARTS,
} from '@libs/hearts-shared-ts/hearts-position';
import { heartsMoves } from '../src/hearts-table.example';

// regression: hearts-story-record-says-no-moves-mid-trick
test('a Hearts story mid-trick lists the cards played, as the app does, not "No moves yet."', () => {
  const position = encodeHearts({
    deal: 4,
    phase: 'play',
    scores: [12, 30, 8, 28],
    lead: 0,
    plays: ['2C', 'TC', 'QS'],
    last: [0, 13, 0, 13],
  });
  expect(heartsMoves(position)).toEqual(['2♣', '10♣', 'Q♠']);
  expect(heartsMoves(encodeHearts(INITIAL_HEARTS))).toEqual([]);
});
