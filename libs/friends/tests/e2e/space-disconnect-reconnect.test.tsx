// goal:spaces:5
import { describe, expect, test } from 'bun:test';
import {
  focusActor,
  partition,
  restartApp,
  restoreNetwork,
  visible,
} from '@libs/sim-harness';
import {
  endSpace,
  joinFromPrompt,
  leaveSpace,
  openSpaceLink,
} from '@libs/spaces/sim/space-actions';
import { activeSpaceVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-friends-sim';
import { expectPresence, twoInASpace } from './support/two-in-a-space';

describe('space disconnect / reconnect', () => {
  test('a guest disconnected when the host ends sees the ended space on reconnect', async () => {
    await using s = await openSim('space-ended-during-partition');
    await twoInASpace(s);
    await expectPresence(s, 'alice', 2);
    await s.apply(partition, 'bob');
    await expectPresence(s, 'alice', 1);
    await s.apply(endSpace, 'alice');

    await s.apply(restoreNetwork);
    await s.apply(focusActor, 'bob');
    await s.until((surf) => visible(surf, 'bob', [Handles.spaceEnded]), {
      maxMs: 20_000,
    });
    expect(await s.read(visible, 'bob', [Handles.spaceJoin])).toBe(false);
    expect(await s.read(visible, 'bob', [Handles.spaceEnded])).toBe(true);
  });

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
