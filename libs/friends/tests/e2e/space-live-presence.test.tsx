// goal:spaces:4
import { describe, test } from 'bun:test';
import { leaveSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-friends-sim';
import { expectPresence, twoInASpace } from './support/two-in-a-space';

describe('space live presence', () => {
  test('everyone sees who is there, and who has left, live', async () => {
    await using s = await openSim('live-presence');
    await twoInASpace(s);
    await expectPresence(s, 'alice', 2);
    await expectPresence(s, 'bob', 2);

    await s.apply(leaveSpace, 'bob');
    await expectPresence(s, 'alice', 1);
  });
});
