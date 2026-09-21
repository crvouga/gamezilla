// goal:social:1
import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
} from '@libs/chess/sim/chess-actions';
import { isPuzzleSolved } from '@libs/chess/sim/chess-puzzle-ui';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-chess-sim';

describe('play without an account', () => {
  test('a guest opens the app, hosts, and solves puzzles — no sign-in anywhere', async () => {
    await using s = await openSim('guest-play');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(true);
    await s.apply(pressPuzzleNext, 'alice');
    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(true);
    // Still a guest: no account was ever created for her.
    expect(await s.read(accountIdOf, 'alice')).toBeNull();
  });
});
