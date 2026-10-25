import { expect, test } from 'bun:test';
import { drawsFromIds } from '@libs/game-matchmaking-shared-ts/multiplayer-hands';

/** Version 4 UUIDs from a counter, as a deterministic id source mints them. */
function countingIds(): () => string {
  let next = 0;
  return () => {
    const hex = (next++ * 2654435761 + 0x9e3779b9)
      .toString(16)
      .padStart(8, '0')
      .slice(-8);
    return `${hex}-0000-4000-8000-000000000000`;
  };
}

// regression: matched-deal-four-draws
test('a matched deal draws every number from a fresh id, never four repeated', () => {
  const draw = drawsFromIds(countingIds());
  // Hearts shuffles with 51 draws and seeds its shuffler with four more.
  const draws = Array.from({ length: 55 }, () => draw());
  expect(new Set(draws).size).toBe(55);
  expect(draws.every((value) => value >= 0 && value < 1)).toBe(true);
});

test('an id with no randomness to give is refused, not read as zero', () => {
  expect(() => drawsFromIds(() => 'room')()).toThrow('an id gives no draw');
});
