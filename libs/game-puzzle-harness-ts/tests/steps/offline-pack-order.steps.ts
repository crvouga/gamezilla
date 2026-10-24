import { expect } from 'bun:test';
import { namedWorkingPackOrder } from '@libs/game-puzzle-harness-ts/pack-observations';
import { Then } from './world';

Then(
  "the pack draft on Alice's tablet contains {string} in that order",
  async (w, titles: string) => {
    expect(
      await w.run.until(
        (s) => namedWorkingPackOrder(s, 'alice:tablet', 'Rivers'),
        { pred: (order) => order === titles, maxMs: 5000 }
      )
    ).toBe(titles);
  }
);
