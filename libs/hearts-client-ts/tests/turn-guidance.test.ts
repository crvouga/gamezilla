import { expect, test } from 'bun:test';
import { heartsFrame } from '@libs/hearts-client-ts/hearts-frame';
import { handCards } from '@libs/hearts-client-ts/hearts-table-view';
import {
  encodeHearts,
  INITIAL_HEARTS,
} from '@libs/hearts-shared-ts/hearts-position';

// regression: hearts-legal-spades-below-refused-diamonds
test('following a spade puts the legal spade before a refused diamond', () => {
  const cards = handCards(
    {
      position: encodeHearts({
        deal: 4,
        phase: 'play',
        scores: [0, 0, 0, 0],
        lead: 0,
        plays: ['2C', '3C', '4C', '5C', '2S'],
        last: null,
      }),
      orientation: 'white',
      hand: '9DQS',
      interactive: true,
      commitment: null,
    },
    []
  );
  expect(cards.map((card) => card.id)).toEqual(['QS', '9D']);
  expect(cards[0]?.enabled).toBe(true);
  expect(cards[1]?.refusal).toBeDefined();
});

// regression: hearts-pending-pass-instruction-conflicts
test('the phase heading never asks to pass again while acknowledgement is pending', () => {
  const text = heartsFrame.turnStatus(
    encodeHearts(INITIAL_HEARTS),
    'white',
    [],
    () => null
  );
  expect(text).toBe('Passing to the left');
  expect(text).not.toContain('Nobody has passed');
});

// regression: hearts-local-turn-compass-decoding
test('North looking at their turn hears Your turn', () => {
  const position = encodeHearts({
    deal: 4,
    phase: 'play',
    scores: [12, 30, 8, 28],
    lead: 0,
    plays: ['2C', '3C'],
    last: null,
  });
  expect(heartsFrame.turnStatus(position, 'red', [], () => null)).toBe(
    'Your turn.'
  );
  expect(heartsFrame.turnStatus(position, null, [], () => null)).toBe(
    'North to play.'
  );
});
