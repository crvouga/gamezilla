/**
 * The whole app's monkey: a seeded random walk over the platform's steps and
 * every feature's own, on the full production composition, with every
 * standing property checked after each step. It is the one walk that crosses
 * features freely — a guest hosting a puzzle while a friend request lands.
 */

import { describe, test } from 'bun:test';
import { APP_WALK_ACTIONS } from '@libs/runtime/sim/app-composition';
import { runMonkey } from '@libs/sim-harness/open-sim/monkey';
import { openSim } from './support/open-app-sim';

describe('app monkey', () => {
  test('a random walk over every feature holds every standing property', async () => {
    await using s = await openSim('monkey');
    await runMonkey(s, { walks: APP_WALK_ACTIONS, steps: 30 });
  }, 300_000);
});
