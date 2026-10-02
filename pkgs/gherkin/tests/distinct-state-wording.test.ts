import { expect, test } from 'bun:test';
import { nearDuplicates } from '@pkgs/gherkin/similarity';

test('different argument domains, progress states and timing promises stay distinct', () => {
  // regression: gherkin-distinct-contracts-collapsed
  for (const texts of [
    ['{actor} is offline', '{device} is offline'],
    [
      "{actor}'s app says the note {string} is still saving",
      "{actor}'s app says the note {string} is saved",
    ],
    [
      '{actor} sees the note {string} at once',
      '{actor} sees the note {string} once',
    ],
  ]) {
    expect(nearDuplicates(texts, (text) => text)).toEqual([]);
  }
});

test('filler aliases of the same typed contract are still refused', () => {
  expect(
    nearDuplicates(
      ['{actor} can ask {actor}', '{actor} can ask {actor} again'],
      (text) => text
    )
  ).toHaveLength(1);
});
