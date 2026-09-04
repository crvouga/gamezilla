import { describe, test } from 'bun:test';

import { openSim } from '../src/setup/open-sim';
import {
  createSpace,
  expectPuzzleSolved,
  openPuzzleFromSpace,
  playUntilSolved,
  returnToTabs,
  signInWithDev,
} from '../src/sim';

describe('chess puzzle play', () => {
  test('host solves a seeded mate-in-1 via board drag', async () => {
    await using s = await openSim('chess-puzzle-play');

    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    await s.apply(playUntilSolved, 'alice');
    await s.apply(expectPuzzleSolved, 'alice');
  });
});
