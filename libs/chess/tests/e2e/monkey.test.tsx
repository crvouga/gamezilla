/**
 * Chess puzzles' monkey: a seeded random walk over the platform's steps and
 * chess's own (open the board from a space, solve or fumble, Next), starting
 * from a guest hosting a space, with every standing property checked after
 * each step — no crash screen, the global menu always reachable, Next never
 * repeats the active puzzle.
 */

import { describe, test } from 'bun:test';
import { CHESS_WALK_ACTIONS } from '@libs/chess/sim/chess-walk';
import { runMonkey } from '@libs/sim-harness/open-sim/monkey';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { SPACES_WALK_ACTIONS } from '@libs/spaces/sim/space-walk';
import { openSim } from './support/open-chess-sim';

describe('chess monkey', () => {
  test('a random walk through puzzles holds every standing property', async () => {
    await using s = await openSim('monkey');
    await s.apply(createSpace, 'alice');
    await runMonkey(s, {
      walks: [...CHESS_WALK_ACTIONS, ...SPACES_WALK_ACTIONS],
    });
  }, 300_000);
});
