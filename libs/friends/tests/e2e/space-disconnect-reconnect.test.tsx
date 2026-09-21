// goal:spaces:5
import { describe, expect, test } from 'bun:test';
import { partition, restartApp, restoreNetwork } from '@libs/sim-harness';
import {
  joinFromPrompt,
  leaveSpace,
  openSpaceLink,
} from '@libs/spaces/sim/space-actions';
import { activeSpaceVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';
import { expectPresence, twoInASpace } from './support/two-in-a-space';

describe('space disconnect / reconnect', () => {
  test('losing the connection and getting it back leaves bob there once', async () => {
    await using s = await openSim('reconnect');
    await twoInASpace(s);
    await expectPresence(s, 'alice', 2);

    // Bob's connection drops: he is gone from alice's sheet, not lingering.
    await s.apply(partition, 'bob');
    await expectPresence(s, 'alice', 1);

    // It comes back: bob is there again — once, not twice.
    await s.apply(restoreNetwork);
    await expectPresence(s, 'alice', 2);
    await expectPresence(s, 'bob', 2);
  });

  test('closing the app and coming back returns bob to the space, once', async () => {
    await using s = await openSim('restart');
    const link = await twoInASpace(s);
    await expectPresence(s, 'alice', 2);

    await s.apply(restartApp, 'bob');
    await s.apply(openSpaceLink, 'bob', link);
    if (!(await s.read(activeSpaceVisible, 'bob'))) {
      await s.apply(joinFromPrompt, 'bob');
    }
    expect(await s.read(activeSpaceVisible, 'bob')).toBe(true);
    await expectPresence(s, 'alice', 2);

    await s.apply(leaveSpace, 'bob');
    await expectPresence(s, 'alice', 1);
  });
});
